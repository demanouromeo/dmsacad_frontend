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

### Auth: wired to the real backend contract

The old client-side-only auth (fetching the whole school's account list and matching `login`/`pwd` against
it in the browser) is gone, along with the `MyReader.fetchAccounts()`/`fetchJsonFromAPI()` methods it
depended on. `LoginForm`'s `connectUser()` now calls `useAuth().login(loginVal, passwordVal,
selectedSchool)` (`src/auth/useAuth.ts`) and navigates to `/dashboard` on success, showing the existing
`t.alertBadCredentials(selectedSchool)` alert on failure.

The backend's actual contract (`AccountController::connect`/`refresh`, confirmed by reading
`routes/api.php`/`AccountController.php` directly, and by exercising the live endpoints with `curl` — don't
assume REST conventions here):

- `POST {baseUrl}api/accounts/connect` with a JSON body `{ login, pwd, connection }` — login. This endpoint
  was originally `GET .../accounts/connect?login=...&pwd=...&connection=...` (password in the query string,
  method named `login()`); it was changed to `POST` + JSON body and the method renamed to `connect()`
  (both `routes/api.php` and `AccountController.php` in the backend repo, alongside `MyReader.login()` here)
  specifically so the password no longer sits in a URL/server log. If you see stray references to `GET
  .../connect` anywhere, they're stale — the route is POST-only now (`php artisan route:list` is the source
  of truth if in doubt; there's also an unrelated `GET api/accounts/{connection}` wildcard route
  (`allAccounts`) that can confusingly match the literal string `"connect"` if you probe it with GET,
  producing a misleading response that isn't the old login handler).
  Returns `{ status, message, access_token, token_type: "Bearer", expires_in, user }` on success, plus a
  `refresh_token` set as an **httpOnly, `SameSite=Strict` cookie** (JS cannot and should not read it
  directly — the browser sends it automatically on requests to the refresh endpoint).
- `POST {baseUrl}api/accounts/refresh` with body `{ connection }`, `credentials: "include"` — mints a new
  `access_token` from the `refresh_token` cookie.
- The connected user's display name is **not** in the top-level `user` object — it's embedded in the JWT
  access token's payload (`name`, along with `role`, `user_id`, `email`, `exp`), decoded client-side via
  `src/dbmanger/jwt.ts`'s `decodeJwtPayload()` (base64url-decode the middle segment, no secret
  needed/available client-side) rather than a `/me` endpoint, which doesn't exist.
- Subsequent authenticated requests need `Authorization: Bearer {access_token}` — `MyReader`'s shared
  `API_OPTIONS` object still has this commented out (`//Authorization: ...`); nothing consumes it yet since
  there's no protected CRUD call wired up from this app yet.
- `POST {baseUrl}api/accounts/logout` (added after the initial contract survey above — backend
  `AccountController::logout`) revokes both tokens server-side: it decodes the `Authorization: Bearer` access
  token (if present) and the `refresh_token` cookie, and blacklists each by `jti` via
  `MyHelper::blacklistToken()` so neither can be replayed before its natural expiry, then clears the
  `refresh_token` cookie. `AuthContext.logout()` calls `MyReader.logout(accessToken)` fire-and-forget (it
  never throws or returns a value the caller must check) purely as a best-effort server-side revoke, then
  always clears in-memory state regardless of whether that call succeeds — a network failure here must never
  block the user from logging out client-side.
- Implemented: the access token lives in memory only (`src/auth/AuthContext.tsx`, `AuthProvider`), never in
  `localStorage`/`sessionStorage`; on app load, it silently calls `MyReader.refreshToken()` to restore the
  session from the httpOnly cookie, using whatever `connection` is already in `sessionStorage`. `useAuth()`
  (`src/auth/useAuth.ts`) is the consumer hook — split into its own file, along with the raw context object
  (`src/auth/authContext.ts`), because ESLint's `react-refresh/only-export-components` errors on a file
  mixing a component and a hook.
- `src/components/routing/RequireAuth.tsx` is the route guard: while `AuthContext.isRestoring` is true (the
  silent-refresh call above hasn't resolved yet) it renders `Loading`; once resolved, it renders its child
  routes via `<Outlet />` if `accessToken` is set, otherwise redirects to `/`. It gates only routes nested
  under it in `App.tsx` — currently just `/dashboard`.
- Local dev's cross-origin credentialed requests (Vite dev server vs. Apache are different ports) were
  verified working end-to-end against the real backend (`curl`-simulated login → refresh round trip with
  `Origin: http://localhost:5173` + cookies, re-verified again after the GET→POST change) —
  `config/cors.php` in the backend repo already lists the Vite dev ports in `allowed_origins` with
  `supports_credentials => true`. No CORS changes were needed.

### i18n

`src/i18n/translations.ts` is a hand-rolled translation table (`Language = "fr" | "en"`), not a general-purpose
i18n library — no longer login-screen-only: it now exports one dictionary per feature area
(`loginTranslations`, `confirmTranslations`, `dashboardTranslations`, ...) rather than one monolithic object.
`src/components/sharedcomp/Flags.tsx` provides the FR/EN flag icon toggle. Selected language persists in
`localStorage[MyConstants.LANGUAGE_KEY]`. Every translatable field needs an entry here — when adding one, add
its FR/EN strings to both `.fr` and `.en` of the relevant dictionary in the same change. If a new screen or
feature needs translation, add a new dictionary following this same pattern (a typed object keyed by
`Language`) rather than pulling in an i18n library, unless asked.

### Toast notifications (`src/toast/`)

App-wide, non-blocking feedback for "what happened after an action" (save succeeded, delete failed, validation
warning), replacing ad hoc inline `<p>`/`FeedbackMessage` state that used to live in individual components.
Same 3-file Context split as `AuthContext`/`LanguageContext`:

- `toastContext.ts` — `createContext` + types only: `ToastType = "info" | "warning" | "danger"`,
  `ToastOptions { type?, durationMs? }`.
- `ToastProvider.tsx` (mounted once in `main.tsx`, outermost provider) — holds the live `ToastItem[]` list,
  exposes `showToast(message, options?)`. Each type has its own default duration
  (`DEFAULT_DURATION_MS: Record<ToastType, number>`, currently 60s for all three, independently tunable per
  type without an API change) unless overridden per-call via `options.durationMs`. Renders
  `ToastViewport` (a fixed `toast toast-end toast-bottom` daisyUI stack) alongside `children`.
- `Toast.tsx` — single toast item; daisyUI `alert`/`alert-info`/`alert-warning`/`alert-error` styling per type
  (`danger` → `alert-error`, since daisyUI has no `alert-danger`) plus a matching lucide icon
  (`Info`/`AlertTriangle`/`AlertCircle`). Self-dismisses via `setTimeout(toast.durationMs)`; also has a manual
  `X` close button so the user can dismiss early — closing (either way) just removes it from the provider's
  list, it doesn't cancel other live toasts.
- `useToast.ts` — consumer hook, throws outside `ToastProvider`; returns `showToast` directly (call sites do
  `const showToast = useToast();`, not destructuring a context object).

Usage convention (see `FiliereManager.tsx`/`SpecialityManager.tsx`'s `handleAdd`/`saveEdit`/
`handleDeleteSelected`): call `showToast(message, { type })` right after an API call resolves — `"info"` for
success, `"danger"` for a failed/error API result, `"warning"` for client-side validation failures caught
before the request is even sent. Both managers also route their messages through per-file translation
dictionaries (`filiereManagerTranslations`/`specialityManagerTranslations` in `src/i18n/translations.ts`)
rather than hardcoded French strings, including distinguishing a duplicate-name API error
(`src/utils/apiErrors.ts`'s `isDuplicateNameError(message)`) from a generic failure — follow this same
per-file-dictionary + `isDuplicateNameError` pattern for new CRUD screens rather than inlining message text.

### Loading overlay (`src/components/sharedcomp/LoadingOverlay.tsx`)

A fixed, full-screen, semi-transparent overlay that centers the existing `Loading` spinner (the same one
`LoginForm` and the managers' initial-load state use). Not Context-based like toast/confirm — it's a plain
presentational component with no state of its own; each screen owns an `isSaving` boolean and renders
`{isSaving && <LoadingOverlay />}`. Convention (see `FiliereManager.tsx`/`SpecialityManager.tsx`): set
`isSaving` to `true` immediately before an async write call (`saveFiliere`/`renameFiliere`/`deleteFilieres`
and their speciality equivalents) and back to `false` immediately after it resolves — a plain
before/after pair is sufficient (no `try/finally`) because `FiliereReader`/`SpecialityReader` never throw,
they catch internally and always resolve to an `ApiResult`. Apply this same pattern to any new
async save/update/delete action rather than leaving the UI unblocked during the request.

### Confirmation dialogs (`src/confirm/`)

Replaces every `window.confirm(...)` in the app with a custom, styled, Promise-based dialog — there should be
no native `confirm()`/`alert()` calls left anywhere in the app; if you add a new destructive action, use this
instead of reaching for `window.confirm`. Same 3-file Context split again:

- `confirmContext.ts` — `createContext` + types: `ConfirmOptions { title?, confirmLabel?, cancelLabel?,
  danger? }`, `ConfirmContextValue { confirm: (message, options?) => Promise<boolean> }`.
- `ConfirmProvider.tsx` (mounted once in `main.tsx`) — holds at most one pending `ConfirmRequest` and a
  `resolveRef` (`useRef`) for its resolver. `confirm(message, options?)` returns
  `new Promise<boolean>((resolve) => { resolveRef.current = resolve; setRequest(...); })`, so call sites await
  it exactly like `window.confirm`: `if (!(await confirm(message))) return;`. Renders one shared native
  `<dialog>` (same ref + `showModal()`/`close()`, `modal`/`modal-box`/`modal-action`/`modal-backdrop` daisyUI
  pattern already used by `LoginForm`'s settings dialog and `TopBanner`'s year/section dialogs — reuse this
  pattern for any future dialog rather than inventing a new one). Escape/backdrop dismissal
  (`handleDialogClose`, wired to the `<dialog>`'s native `close` event) resolves `false`, same as Cancel.
  `options.danger: true` renders the confirm button `btn-error` (red) instead of `btn-primary` — pass this for
  destructive actions like deletes. Default title/button labels come from `confirmTranslations[language]`
  (`src/i18n/translations.ts`), overridable per-call via `options`.
- `useConfirm.ts` — consumer hook, throws outside `ConfirmProvider`; returns `confirm` directly
  (`const confirm = useConfirm();`).

Both `ToastProvider` and `ConfirmProvider` are mounted in `main.tsx`, wrapping `CookiesProvider`/`AuthProvider`
(inside `LanguageProvider`, outside everything auth-related) — since neither depends on auth state, and both
need to be available to `LoginForm` itself as well as authenticated screens.

### Connectivity monitor (`src/connectivity/ConnectivityMonitor.tsx`)

A single always-mounted, render-nothing component (`main.tsx`, inside `ToastProvider` — it calls `useToast()`
— and outside `ConfirmProvider`, which it doesn't need) that runs a background heartbeat for the whole app
session, logged-in or not. On mount and every 15s (`CHECK_INTERVAL_MS`) it: bails out immediately with a
`"danger"` toast (`t.offline`) if `navigator.onLine` is `false`; otherwise sends a `GET` to
`{MyConstants.getBaseUrl()}api/configs/allSchools` (the same unauthenticated, no-params endpoint `LoginForm`
already uses to populate the school picker — chosen because it needs no backend changes and no auth context)
under a 5s (`CHECK_TIMEOUT_MS`) `AbortController` timeout. A thrown/aborted fetch means the backend is
unreachable → `"danger"` toast (`t.serverUnavailable`); a resolving fetch (regardless of HTTP status — an
error status still proves the server answered) means it's reachable. A native `window` `"offline"` event
listener fires the same offline toast immediately rather than waiting for the next poll tick.

An `isReachableRef` (`useRef<boolean>`, not `useState` — this must not cause re-renders since the component
renders nothing) tracks the last known state so a toast only fires **on transition** (reachable → unreachable
or back) rather than once per poll while an outage persists — a 15s outage doesn't spam ten toasts, and
recovery gets its own `"info"` toast (`t.backOnline`). Messages come from `connectivityTranslations`
(`src/i18n/translations.ts`). If a dedicated lightweight backend health-check route is ever added, prefer
switching this component to call it over continuing to piggyback on `allSchools`.

### Routing and state

`src/App.tsx` (React Router v7, `BrowserRouter`) defines `/` → `LoginForm`, and `/dashboard` → `Dashboard`
nested under the `RequireAuth` guard route (see Auth section above). `Footer` renders only when the
`schoolName` cookie is present. `src/components/dashboard/Dashboard.tsx` renders
`useAuth().authPayload?.name` and a logout button (`useAuth().logout()` then `navigate("/")`); it replaced
the old `TeacherIndex.tsx` placeholder, which did its own inline `sessionStorage[SCHOOL_NAME_KEY]` check and
is gone. Role-specific dashboard variants (teacher vs. admin vs. other roles from `authPayload.role`) are
explicitly deferred past v1.
No global state library is used — `react-cookie` (`CookiesProvider` in `main.tsx`) plus plain
`useState`/`sessionStorage`/`localStorage`/the one `AuthContext` is the existing pattern; keep using it
rather than introducing Redux/Zustand unless the user asks.

### Data fetching

`src/dbmanger/MyReader.tsx` is a static class wrapping native `fetch` (no axios in this project). It has
`fetchSchools()` and `fetchSchoolYears(connection)` so far. Each method follows the same shape: build the URL
off `MyConstants.getBaseUrl()`, check `response.ok`, check `data.Response === "False"` for an API-level
error, `alert()` and return `[]` on any failure, log to console. Follow this same shape for new read-only
fetch methods. `login()`/`refreshToken()`/`logout()` (see Auth section) are an intentional exception — the
first two return `null`/`false` on failure instead of `alert()` + `[]`, since `LoginForm` needs to
distinguish "bad credentials" from "network error" for inline UI feedback rather than a blind alert;
`logout()` swallows errors entirely and returns `void`, since it's a best-effort fire-and-forget call.

## Current state vs MVP scope

This codebase is pre-MVP. The features below are the agreed MVP scope (from the product's feature overview
and explicit requirements) and their current status:

| Feature | Status |
|---|---|
| Choose a school before logging in | Done — `LoginForm` school `<select>`, populated from `fetchSchools()`, hidden/forced to `mysql` when target is Local |
| Choose a school year before logging in | Done — `LoginForm` school-year `<select>`, populated from `fetchSchoolYears(connection)`, persisted alongside the school |
| Display language toggle (en/fr) | Done — `Flags.tsx` + `translations.ts`, persisted to `localStorage` |
| Choose remote vs local backend server | Done — `MyConstants.getBaseUrl()`/`setBackendTarget()`, toggle in `LoginForm`; Local also special-cases the school picker (see Architecture) |
| Real login against backend (`connection`/`login`/`pwd`/`year` → JWT) | Done — `LoginForm.connectUser()` calls `useAuth().login()`, which calls `MyReader.login()` → `POST api/accounts/connect` |
| Store access token + refresh token, attach to requests | Done (storage/restore side) — `AuthContext` holds the access token in memory and silently restores it via `MyReader.refreshToken()` on app load. Attaching `Authorization: Bearer` to CRUD calls is still unaddressed since no protected CRUD endpoint is wired up from this app yet |
| Navigate to and gate app functionality behind auth | Done — `RequireAuth` gates `/dashboard` on `AuthContext.accessToken`, redirecting to `/` once the silent-refresh restore (`isRestoring`) resolves with no valid session |
| Dashboard showing the connected user's name (v1) | Done — `Dashboard.tsx` renders `useAuth().authPayload?.name` plus a logout button; role-specific variants are deferred past v1 |

This closes out the MVP scope from `IMPLEMENTATION_PLAN.md`'s phased breakdown (Phases 1-5; Phase 6 was this
doc/cleanup pass). When extending the app past v1 (role-specific dashboards, protected CRUD calls attaching
`Authorization: Bearer`, etc.), prefer extending the existing files (`MyConstants`, `MyReader`, `LoginForm`,
`Dashboard`, `AuthContext`) over introducing new architectural layers — this app is small and the existing
patterns (react-cookie + plain state + static utility classes + the one `AuthContext`) are intentional for
now.
