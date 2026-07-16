# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

React + TypeScript (Vite) frontend for DMS ACAD, a multi-school academic management system. It talks to the
Laravel REST API in the sibling `dmsacad_backend_dev` repo (see that repo's `CLAUDE.md` for the backend's
multi-tenancy and auth contract — this frontend must match it exactly, not invent its own). The app is also
wrapped for Android via Capacitor (`@capacitor/*`, `capacitor.config.ts`).

Login_img1.png (`src/assets/medium/login_img1.png`) is the product's feature overview: student records
(présence/contact), subject/course management, report cards ("bulletin de notes"), and staff management
(roles, schedules, leave). Those are the eventual functional modules — most don't exist in this codebase yet
(see "Current state vs MVP" below).

## Commands

```bash
npm install
npm run dev        # vite dev server
npm run build       # tsc -b && vite build
npm run lint        # eslint .
npm run preview     # preview production build
```

No test runner is configured. There's no `.env`/`.env.example` and no path aliases in `tsconfig.app.json` or
`vite.config.ts` (`vite.config.ts` has a commented-out dev proxy to `https://dmsacad.com/api` — currently
unused, all requests hit absolute URLs from `MyConstants`).

There's a phased build-out plan at `IMPLEMENTATION_PLAN.md` (repo root) — read it before starting new
auth/session work to see what's already decided (token storage strategy, endpoint contracts, what's
explicitly out of scope) rather than re-deriving it.

## Architecture

### Backend base URL: remote vs local — implemented, drives the school picker too

`src/dbmanger/MyConstants.tsx` defines both backend targets plus the switch itself:

```ts
public static gBaseRemoteUrl = "https://dmsacad.com/dmsacad_backend_secured/";
public static gBaseLocalUrl = "http://localhost/dmsacad_backend_dev/";
public static gLocalSchoolCode = "mysql";
```

`MyConstants.getBackendTarget()`/`setBackendTarget()` persist the user's choice (`"remote" | "local"`) to
`localStorage[BACKEND_TARGET_KEY]`, default `"remote"`; `getBaseUrl()` resolves it to one of the two URLs
above. `MyReader` methods must call `MyConstants.getBaseUrl()` per-request (not read `gBaseRemoteUrl`
directly) so they respect the switch — `fetchSchools()` and `fetchSchoolYears()` already do this.

`LoginForm.tsx` renders a Remote/Local toggle (`handleBackendTargetChange`) above the language flags. Local
is special-cased, not just a different URL: the local XAMPP backend only ever serves the single `mysql`
connection (see backend `CLAUDE.md`'s "one database per school" model — locally there's just one), so
choosing "Local" **forces `selectedSchool` to `MyConstants.gLocalSchoolCode`** and **hides the school
`<select>` and its label entirely** (`{backendTarget !== "local" && (...)}`) rather than letting the user pick
from a list that wouldn't apply locally. A separate `remoteSchool` state remembers whatever was selected
before switching to Local, and switching back to "Remote" restores it (see `handleBackendTargetChange` and
the mount `useEffect`, which also force-applies this if `"local"` was already the persisted target from a
previous session). Preserve this asymmetry if you touch this code — don't make the school picker
target-agnostic.

### Multi-tenancy: school + school year both map to backend params

The backend has no single database — every request needs a `connection` value matching a key in the
backend's `config/database.php` (e.g. `mysql`, `CES_DE_LDIRI`, `LYCEE_DE_PITOA`), **and** (per
`ClasseController` and most other CRUD controllers) a `year` string (e.g. `"2024-2025"`) identifying the
active school year within that connection. `MyReader.fetchSchools()` hits `GET {baseUrl}api/configs/allSchools`
— confirmed (`SchoolInfoController::allSchools()`) to return a flat array of connection-key strings directly,
no separate display name, so `selectedSchool` in `LoginForm` already *is* the `connection` value to send
everywhere (no mapping needed).

`MyReader.fetchSchoolYears(connection)` hits `GET {baseUrl}api/configs/getSchoolYears?connection=...`
(confirmed `SchoolInfoController::getSchoolYears()`), returning `[{sy_id, year, is_current}]`
(`src/interfaces/SchoolYear.tsx`). `LoginForm` shows a school-year `<select>` under the school picker,
populated/reset whenever the school (or backend target) changes, required before submit alongside the
school. **Persist and pass the `year` string, not `sy_id`** — that's what the backend's CRUD endpoints
actually expect. Both selections are written to `sessionStorage` on submit
(`SCHOOL_NAME_KEY`/`SCHOOL_YEAR_KEY` in `MyConstants`) and restored on mount; treat both as part of "the
connected user's session" going forward — any future `AuthContext`/CRUD work needs to read `SCHOOL_YEAR_KEY`
the same way it reads the school, not just at login time.

### Auth: not yet wired to the real backend contract

The old client-side-only auth (fetching the whole school's account list and matching `login`/`pwd` against
it in the browser) has been removed from `LoginForm.tsx` along with the `MyReader.fetchAccounts()` and
`MyReader.fetchJsonFromAPI()` methods it depended on — `MyReader` currently has `fetchSchools()` and
`fetchSchoolYears()` only, no login/token methods yet. `LoginForm.handleSubmit` now calls an empty stub,
`connectUser()` (bottom of `src/components/logincomps/LoginForm.tsx`), which is the intended integration
point for the real login call described below — implement it there rather than inline in `handleSubmit`.

The backend's actual contract (`AccountController::login`/`refresh`, confirmed by reading
`routes/api.php`/`AccountController.php` directly — don't assume REST conventions here):

- `GET {baseUrl}api/accounts/connect?login=...&pwd=...&connection=...` — yes, **GET**, with the password as a
  query param; that's the backend's existing design, not something to fix from this repo. Returns
  `{ status, message, access_token, token_type: "Bearer", expires_in, user }` on success, plus a
  `refresh_token` set as an **httpOnly, `SameSite=Strict` cookie** (JS cannot and should not read it
  directly — the browser sends it automatically on requests to the refresh endpoint).
- `POST {baseUrl}api/accounts/refresh` with body `{ connection }`, `credentials: "include"` — mints a new
  `access_token` from the `refresh_token` cookie.
- The connected user's display name is **not** in the top-level `user` object — it's embedded in the JWT
  access token's payload (`name`, along with `role`, `user_id`, `email`, `exp`). To show the name on the
  dashboard (MVP requirement), decode the JWT payload client-side (base64url-decode the middle segment — no
  secret needed/available client-side) rather than expecting a `/me` endpoint that doesn't exist yet.
- Subsequent authenticated requests need `Authorization: Bearer {access_token}` — `MyReader`'s shared
  `API_OPTIONS` object currently has this commented out (`//Authorization: ...`) and needs a real
  implementation that reads the stored access token.
- No backend logout endpoint exists — logout is necessarily client-side-only (clear in-memory state).
- Decided (see `IMPLEMENTATION_PLAN.md`): the access token lives in memory only (React context), never in
  `localStorage`/`sessionStorage`; on app load, silently call the refresh endpoint to restore the session from
  the httpOnly cookie. Local dev needs the backend's CORS config to allow credentialed cross-origin requests
  (Vite dev server vs. Apache are different ports) for that cookie to round-trip — flagged as a
  backend-repo dependency, not something to patch from here.

### i18n

`src/i18n/translations.ts` is a hand-rolled, login-screen-only translation table (`Language = "fr" | "en"`,
`loginTranslations`), not a general-purpose i18n library. `src/components/sharedcomp/Flags.tsx` provides the
FR/EN flag icon toggle. Selected language persists in `localStorage[MyConstants.LANGUAGE_KEY]`. Every
login-screen field needs an entry here (school, school year, credentials, alerts, etc.) — when adding a field
to `LoginForm`, add its FR/EN strings to both `loginTranslations.fr` and `.en` in the same change. If more
screens need translation, extend this same pattern (a typed dictionary keyed by `Language`) rather than
pulling in an i18n library, unless asked.

### Routing and state

`src/App.tsx` (React Router v7, `BrowserRouter`) currently defines two routes: `/` → `LoginForm`, and
`/dashboard-teacher` → `TeacherIndex`. `Footer` renders only when the `schoolName` cookie is present. There's
no route-guard component/HOC — `TeacherIndex` (`src/components/dashboard/TeacherIndex.tsx`) does its own
inline check of `sessionStorage[SCHOOL_NAME_KEY]` and renders `AccessDenied`/`AccessGranted` placeholders.
No global state library is used — `react-cookie` (`CookiesProvider` in `main.tsx`) plus plain
`useState`/`sessionStorage`/`localStorage` is the existing pattern; keep using it rather than introducing
Redux/Zustand/Context unless the user asks.

### Data fetching

`src/dbmanger/MyReader.tsx` is a static class wrapping native `fetch` (no axios in this project). It has
`fetchSchools()` and `fetchSchoolYears(connection)` so far. Each method follows the same shape: build the URL
off `MyConstants.getBaseUrl()`, check `response.ok`, check `data.Response === "False"` for an API-level
error, `alert()` and return `[]` on any failure, log to console. Follow this same shape for new read-only
fetch methods. The planned `login()`/`refreshToken()` methods (see Auth section and
`IMPLEMENTATION_PLAN.md`) are an intentional exception — they should return `null`/`false` on failure instead
of `alert()` + `[]`, since `LoginForm` needs to distinguish "bad credentials" from "network error" for inline
UI feedback rather than a blind alert.

## Current state vs MVP scope

This codebase is pre-MVP. The features below are the agreed MVP scope (from the product's feature overview
and explicit requirements) and their current status:

| Feature | Status |
|---|---|
| Choose a school before logging in | Done — `LoginForm` school `<select>`, populated from `fetchSchools()`, hidden/forced to `mysql` when target is Local |
| Choose a school year before logging in | Done — `LoginForm` school-year `<select>`, populated from `fetchSchoolYears(connection)`, persisted alongside the school |
| Display language toggle (en/fr) | Done — `Flags.tsx` + `translations.ts`, persisted to `localStorage` |
| Choose remote vs local backend server | Done — `MyConstants.getBaseUrl()`/`setBackendTarget()`, toggle in `LoginForm`; Local also special-cases the school picker (see Architecture) |
| Real login against backend (`connection`/`login`/`pwd`/`year` → JWT) | **Missing** — old client-side list match was removed; `LoginForm.handleSubmit` now calls an empty `connectUser()` stub, the intended place to add the `GET api/accounts/connect` request |
| Store access token + refresh token, attach to requests | **Missing** — no token storage exists yet; decided approach is in-memory only + silent refresh via the httpOnly cookie on app load (see Auth section, `IMPLEMENTATION_PLAN.md`) |
| Navigate to and gate app functionality behind auth | **Partial** — routing exists (`react-router-dom`) but there's no real auth guard; `TeacherIndex`'s check is a placeholder tied to school selection, not to having a valid token |
| Dashboard showing the connected user's name (v1) | **Missing** — `TeacherIndex` is a static placeholder (`<h1>Teacher Index Page</h1>`); needs to read the user's name (from the decoded JWT payload, see Auth section above) and render it |

When implementing these, prefer extending the existing files (`MyConstants`, `MyReader`, `LoginForm`,
`TeacherIndex`) over introducing new architectural layers (e.g. no need for a full state-management library
or a routing guard framework) — this app is small and the existing patterns (react-cookie + plain state +
static utility classes) are intentional for now. `IMPLEMENTATION_PLAN.md` has the phased breakdown for the
remaining "Missing"/"Partial" rows — check it before re-planning this from scratch.
