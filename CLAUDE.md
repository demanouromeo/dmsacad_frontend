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

## Architecture

### Backend base URL: remote vs local, and why it matters

`src/dbmanger/MyConstants.tsx` defines both backend targets:

```ts
public static gBaseRemoteUrl = "https://dmsacad.com/dmsacad_backend_secured/";
public static gBaseLocalUrl = "http://localhost/dmsacad_backend_dev/";
```

Today every call in `src/dbmanger/MyReader.tsx` is hardcoded to `gBaseRemoteUrl` — there is no runtime switch
yet. Introducing one (env var, build flag, or in-app toggle) is part of the MVP (see below); when you add it,
route it through a single place (e.g. a `MyConstants.gBaseUrl` getter) rather than editing every call site in
`MyReader`.

### Multi-tenancy: school selection maps to the backend's `connection` param

The backend has no single database — every request needs a `connection` value matching a key in the
backend's `config/database.php` (e.g. `mysql`, `LY_MERI`, `CES_DE_DABAYE`). `MyReader.fetchSchools()` hits
`GET {baseUrl}api/configs/allSchools` to list schools, and `LoginForm` currently stores whatever string comes
back from that list directly as the `schoolName` cookie and `sessionStorage[SCHOOL_NAME_KEY]` — i.e. today
"selected school" and "connection code" are conflated into one opaque string. When wiring real login/API
calls, confirm what `allSchools` actually returns (code vs. display name) and make sure the value sent as
`connection` on every subsequent request (login, and later every CRUD call) is the backend connection key,
not a human-readable name — introduce a separate field/interface if the API returns both.

### Auth: not yet wired to the real backend contract

The old client-side-only auth (fetching the whole school's account list and matching `login`/`pwd` against
it in the browser) has been removed from `LoginForm.tsx` along with the `MyReader.fetchAccounts()` and
`MyReader.fetchJsonFromAPI()` methods it depended on — `MyReader` currently only has `fetchSchools()`.
`LoginForm.handleSubmit` now calls an empty stub, `connectUser()` (bottom of
`src/components/logincomps/LoginForm.tsx`), which is the intended integration point for the real login call
described below — implement it there rather than inline in `handleSubmit`.

The backend's actual contract (`AccountController::login`, see backend `CLAUDE.md`):

- `POST {baseUrl}api/login` (adjust path to whatever's in `routes/api.php`) with body
  `{ login, pwd, connection }`.
- Response body: `{ status, message, access_token, token_type: "Bearer", expires_in, user }`, plus a
  `refresh_token` set as an **httpOnly cookie** (so JS cannot and should not read it directly — the browser
  sends it automatically on same-site requests to `POST {baseUrl}api/refresh`).
- The connected user's display name is **not** in the top-level `user` object — it's embedded in the JWT
  access token's payload (`name`, along with `role`, `user_id`, `email`, `exp`). To show the name on the
  dashboard (MVP requirement), decode the JWT payload client-side (base64-decode the middle segment — no
  secret needed/available client-side) rather than expecting a `/me` endpoint that doesn't exist yet.
- Subsequent authenticated requests need `Authorization: Bearer {access_token}` — `MyReader`'s shared
  `API_OPTIONS` object currently has this commented out (`//Authorization: ...`) and needs a real
  implementation that reads the stored access token.

### i18n

`src/i18n/translations.ts` is a hand-rolled, login-screen-only translation table (`Language = "fr" | "en"`,
`loginTranslations`), not a general-purpose i18n library. `src/components/sharedcomp/Flags.tsx` provides the
FR/EN flag icon toggle. Selected language persists in `localStorage[MyConstants.LANGUAGE_KEY]`. If more
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

`src/dbmanger/MyReader.tsx` is a static class wrapping native `fetch` (no axios in this project). Its only
method right now is `fetchSchools()`. Each method follows the same shape: call, check `response.ok`, check
`data.Response === "False"` for an API-level error, `alert()` and return `[]` on any failure, log to console.
Follow this same shape for new fetch methods (e.g. the login call `connectUser()` needs to make) — don't
introduce a different error-handling convention without asking.

## Current state vs MVP scope

This codebase is pre-MVP. The features below are the agreed MVP scope (from the product's feature overview
and explicit requirements) and their current status:

| Feature | Status |
|---|---|
| Choose a school before logging in | Done — `LoginForm` school `<select>`, populated from `fetchSchools()` |
| Display language toggle (en/fr) | Done — `Flags.tsx` + `translations.ts`, persisted to `localStorage` |
| Choose remote vs local backend server | **Missing** — `gBaseRemoteUrl`/`gBaseLocalUrl` both exist in `MyConstants` but nothing lets the user pick, and `MyReader` is hardcoded to remote |
| Real login against backend (`connection`/`login`/`pwd` → JWT) | **Missing** — old client-side list match was removed; `LoginForm.handleSubmit` now calls an empty `connectUser()` stub, the intended place to add the `api/login` request |
| Store access token + refresh token, attach to requests | **Missing** — no token storage exists; `refresh_token` will arrive as an httpOnly cookie (nothing to do client-side beyond letting the browser send it); `access_token` needs explicit storage (e.g. memory/sessionStorage) and attaching as `Authorization: Bearer` on every authenticated call |
| Navigate to and gate app functionality behind auth | **Partial** — routing exists (`react-router-dom`) but there's no real auth guard; `TeacherIndex`'s check is a placeholder tied to school selection, not to having a valid token |
| Dashboard showing the connected user's name (v1) | **Missing** — `TeacherIndex` is a static placeholder (`<h1>Teacher Index Page</h1>`); needs to read the user's name (from the decoded JWT payload, see Auth section above) and render it |

When implementing these, prefer extending the existing files (`MyConstants`, `MyReader`, `LoginForm`,
`TeacherIndex`) over introducing new architectural layers (e.g. no need for a full state-management library
or a routing guard framework) — this app is small and the existing patterns (react-cookie + plain state +
static utility classes) are intentional for now.
