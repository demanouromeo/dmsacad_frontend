# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

React + TypeScript (Vite) frontend for DMS ACAD, a multi-school academic management system. It talks to the
Laravel REST API in the sibling `dmsacad_backend_dev` repo (see that repo's `CLAUDE.md` for the backend's
multi-tenancy and auth contract — this frontend must match it exactly, not invent its own). The app is also
wrapped for Android via Capacitor (`@capacitor/*`, `capacitor.config.ts`).

Login_img1.png (`src/assets/medium/login_img1.png`) is the product's feature overview: student records
(présence/contact), subject/course management, report cards ("bulletin de notes"), and staff management
(roles, schedules, leave). The original auth/session MVP (`IMPLEMENTATION_PLAN.md`, Phases 1-5) is complete;
the app is now in a second build-out phase adding the ADMIN-only functional modules reachable from the
dashboard's menu grid — school basic info, filières, spécialités, classes, subjects, and staff are built;
student records, marks entry, report cards, and staff scheduling/leave are not yet (see "Current state vs
MVP" below for the up-to-date module-by-module status).

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

### Multi-tenancy: school + school year + section all map to backend params

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
connected user's session" going forward.

Most admin CRUD endpoints (Filiere/Speciality/Classe/Subject) also take a third dimension, `section` — a
literal `"francophone" | "anglophone"` string, not a backend-driven list (`SectionReader.fetchSections()`
exists and hits the real `/api/section/getSections` endpoint, but nothing currently wires it in; both
`LoginForm` and `TopBanner` still hardcode the two-option radio group). `section` is set once at login
(`LoginForm`'s radio group, defaulting to `"francophone"`) and persisted the same way as school/year
(`SECTION_KEY`). Staff is the one exception among the CRUD modules — `StaffReader.fetchStaff()` only takes
`connection`+`year`, not `section`, since a staff member isn't scoped to one section. All three
(`connection`/`schoolYear`/`section`) are read from `useAuth()` in every screen that needs them — never read
`sessionStorage` directly outside `AuthContext`/`TopBanner`/`LoginForm`.

### Auth: wired to the real backend contract

The old client-side-only auth (fetching the whole school's account list and matching `login`/`pwd` against
it in the browser) is gone, along with the `MyReader.fetchAccounts()`/`fetchJsonFromAPI()` methods it
depended on. `LoginForm`'s `connectUser()` now calls `useAuth().login(loginVal, passwordVal, selectedSchool,
selectedSchoolYear, selectedSection)` (`src/auth/useAuth.ts`) and navigates to `/dashboard` on success,
showing the existing `t.alertBadCredentials(selectedSchool)` alert on failure.

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
- Subsequent authenticated requests need `Authorization: Bearer {access_token}`. `MyReader`'s shared
  `API_OPTIONS` object still has this commented out (`//Authorization: ...`) — that class only ever backs
  the two unauthenticated pre-login endpoints (`fetchSchools`/`fetchSchoolYears`/`login`/`refreshToken`/
  `logout`), so it never needed it. Every other `*Reader` class (`FiliereReader`, `SpecialityReader`,
  `ClasseReader`, `SubjectReader`, `StaffReader`, `SectionReader`, `SchoolInfoReader`) attaches it per-request
  instead, spreading a conditional `Authorization: Bearer {accessToken}` entry into its `headers` object only
  when a token is present, reading `accessToken` from `useAuth()` at the call site. Follow this per-class
  pattern for new protected reads/writes rather than resurrecting the commented-out line in `MyReader`.
- On every successful login, `AuthContext.login()` also fetches
  `SchoolInfoReader.fetchSchoolConfigOfYear(...)` and, if it resolves, stores the raw response in a
  `SCHOOL_HEADER_CONFIG_KEY` **cookie** (`react-cookie`, 7-day `maxAge` — see `MyConstants`), or removes the
  cookie if the fetch fails/returns nothing. This is best-effort and fire-and-forget with respect to login
  itself (a failure here never blocks `login()` from returning `true`). It exists so a future
  printed/exported document (report cards, bulletins) can build a school header (name, address, logo) from a
  cookie already in hand instead of an extra round trip — nothing reads this cookie yet.
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
  silent-refresh call above hasn't resolved yet) it renders `Loading`; once resolved, it renders `TopBanner`
  plus its child routes via `<Outlet />` if `accessToken` is set, otherwise redirects to `/`. Every
  authenticated route in `App.tsx` is nested under it — `/dashboard` and, one level deeper, the whole
  `RequireRole`-gated `/admin/*` subtree (see Role-gated admin routing below).
- Local dev's cross-origin credentialed requests (Vite dev server vs. Apache are different ports) were
  verified working end-to-end against the real backend (`curl`-simulated login → refresh round trip with
  `Origin: http://localhost:5173` + cookies, re-verified again after the GET→POST change) —
  `config/cors.php` in the backend repo already lists the Vite dev ports in `allowed_origins` with
  `supports_credentials => true`. No CORS changes were needed.

### Top banner & global session controls (`src/components/layout/TopBanner.tsx`)

A fixed `navbar` mounted once by `RequireAuth` (see above), above every authenticated route, replacing what
used to be a per-page "back to dashboard" button. It reads `connection`, `schoolYear`, `section`,
`setSchoolYear`, `setSection` from `useAuth()` (the latter two update both React state and the matching
`sessionStorage` key, mirroring how `login()` seeds them) plus `useLanguage()` for the display language:

- **Home** icon — `<Link to="/dashboard">`.
- **School year** icon — opens a `<dialog>` that lazily fetches `MyReader.fetchSchoolYears(connection)` into a
  draft `<select>` (seeded from the current `schoolYear`); Save commits via `setSchoolYear`, Cancel/backdrop
  discards.
- **Section** icon — same dialog shape, but a hardcoded francophone/anglophone radio pair (matching
  `LoginForm`'s, not `SectionReader`-driven — see the multi-tenancy note above) committed via `setSection`.
- **Language** — a daisyUI dropdown showing the current language's flag (`FlagFR`/`FlagGB`), selecting the
  other calls `setLanguage`.
- **Avatar** — a static `avatar-placeholder` circle with a generic person icon; there's no profile screen yet,
  so it's non-interactive by design, not a stub someone forgot to wire up.

Both dialogs reuse the same native-`<dialog>` + `modal`/`modal-box`/`modal-backdrop` pattern as `LoginForm`'s
settings dialog. Changing year/section here takes effect immediately for anything reading `useAuth()` on
render (e.g. `Dashboard`'s `{schoolYear} — {section}` line) but is **not** retroactively pushed into an
already-mounted admin screen's own data-loading effect — e.g. `FiliereManager` only picks up a changed
section on its next mount, not live while already open. `bannerTranslations` (`src/i18n/translations.ts`)
holds its strings.

### Role-gated admin routing

`src/components/routing/RequireRole.tsx` is a second route guard (nested *inside* `RequireAuth`, not
replacing it): it reads `authPayload.role` from `useAuth()` and renders `<Outlet />` only if `role` is in the
`allow` prop's list, otherwise redirects to `/dashboard`. `App.tsx` wraps every `/admin/*` route in one
`<Route element={<RequireRole allow={["ADMIN"]} />}>` group. `AdminMenuGrid`'s `ADMIN_MENU_ITEMS` array pairs
each dashboard card with an icon and an optional `to` — a card only navigates if `to` is set; the rest render
as inert placeholders for modules that don't exist yet. When a new admin screen ships, add its route inside
that `RequireRole` group in `App.tsx` **and** set `to` on its `AdminMenuGrid` entry in the same change — a
screen with a route but no `to` is unreachable from the UI, and a card with `to` but no route 404s.

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

### Admin CRUD screens (Filière / Spécialité / Classe / Subject / Staff)

Five screens (`src/components/admin/{filiere,speciality,classe,subject,staff}/*Manager.tsx`) share one
established pattern — when adding a new admin CRUD screen, follow this shape rather than inventing a new one:

- **A `*Reader` static class** (`src/dbmanger/{Filiere,Speciality,Classe,Subject,Staff}Reader.tsx`) wrapping
  `fetch`, one file per feature. Every write method (`save*`/`update*`/`delete*`) delegates to a private
  `postJson(path, accessToken, body, callerName)` helper that POSTs JSON, attaches
  `Authorization: Bearer {accessToken}` when present, and on any thrown error logs
  `` `ClassName.methodName(): Error: ${error}` `` and resolves to a shared `NETWORK_ERROR_RESULT` (`{status:
  false, message: "Network error..."}`) rather than rejecting — callers never need a `try/catch`. List-mutation
  endpoints (`updateMany*`/`deleteMany*`) send the array as `data: JSON.stringify(items)` plus `data_size`
  (Laravel's `json` validation rule needs a string, not a nested array). Read methods (`fetch*`) are separate
  plain `GET`s, returning `[]` on failure and logging to console rather than using `postJson`.
- **A `*Manager.tsx` component** (`src/components/admin/<feature>/`): loads its list on mount and whenever
  `connection`/`schoolYear`/`section` change (`useAuth()`); renders a checkbox-select table (inline
  `Modifier`/`Enregistrer`/`Annuler` edit-in-row, no separate edit screen) plus an add-row form at the bottom;
  a `useConfirm()` dialog gates the multi-select delete button; every write path wraps `isSaving`
  true/false around the async call and renders `{isSaving && <LoadingOverlay />}`; every result (success,
  duplicate-name failure, generic failure) triggers `showToast()` via a per-file translation dictionary
  (`filiereManagerTranslations`, etc., in `src/i18n/translations.ts`).
- **Search/filter**: every list screen (Filière/Spécialité/Classe/Staff/Subject/Groupe/Student) has a local
  `searchQuery` state (reset alongside the load effect's `connection`/`schoolYear`/`section` deps, not on a
  mutation-triggered reload), a case-insensitive substring match across the row's visible text fields into a
  derived `filtered*` array, a search `<input>` above the table, and a distinct "no search results" empty-state
  row separate from the "list is empty" one. `toggleSelectAll` operates on the **filtered** subset only (not
  the full list), and CSV/PDF export always exports the full unfiltered list regardless of an active search —
  follow this exact shape for a new screen's search box rather than inventing a different filter UI.
- **`src/utils/apiErrors.ts`'s `isDuplicateNameError(message)`** — regex-matches `/duplicate|already
  exists|already used/i` against the backend's raw (often unlocalized/inconsistent) error message to decide
  whether to show a "name already exists" vs. a generic failure toast. `"already used"` specifically covers
  `StaffController`'s login/phone1 uniqueness wording, which differs from Filiere/Speciality/Classe/Subject's
  "already exists" — extend this regex rather than adding a second duplicate-detection helper if another
  backend wording shows up.
- **`src/utils/textValidation.ts`'s `sanitizeFiliereOrSpecialityName`/`MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH`**
  — despite the name, shared generically across Filiere/Speciality/Classe/Subject name inputs (strips
  disallowed characters on every keystroke via `onChange`). Staff name/surname/login/pwd fields legitimately
  need characters this regex would strip (e.g. apostrophes in "N'Diaye"), so they're only trimmed/length-checked,
  not character-filtered — see the comment in that file before reusing it for a new free-text field.
- Staff is the outlier: `StaffManager` also creates the linked `Account` row in the same `saveStaff` call
  (login/pwd are mandatory, not optional), and its `updateStaff` treats `pwd` as optional-per-row — omit it
  entirely to leave the account password unchanged rather than round-tripping the plaintext value the list
  endpoint returns (the backend only rotates the password when a non-empty value is supplied). Since
  `allStaffs1` already returns the plaintext `pwd` per row, each row also has an `Eye`/`EyeOff` toggle
  (`visiblePasswordIds`, a `Set<number>` of `staff_id`s) revealing that row's current password on demand,
  masked (`••••••••`) by default and reset on every reload — this is a separate concern from the `New
  password` column (which only ever holds a not-yet-saved replacement value), and `pwd` must still never
  appear in `exportColumns`/CSV/PDF export. The add-staff form's own password `<input>` has its own
  independent `Eye`/`EyeOff` show/hide toggle (`showNewPassword`), plus a "Generate login and password" button
  (`Wand2` icon) that fills both `newLogin`/`newPassword` with a random 6-character `a-zA-Z0-9` string
  (`randomCredentialString`), retried up to 50 times against the currently-loaded `staffList`'s logins for
  unique-enough uniqueness (best-effort — `Account.login` is globally unique server-side across the whole
  school, not just the current year's staff list, but 62^6 combinations plus the existing `addDuplicate` toast
  path make a residual collision negligible).

### Subjects hub and the APC / competence-based classe concept

`/admin/subjects` (`SubjectsHub.tsx`) is a landing page for 4 sub-modules, not a CRUD screen itself —
`AdminMenuCard` tiles, each with its own route nested in the same `RequireRole allow={["ADMIN"]}` group as
every other `/admin/*` route: `matieres` (`/admin/subjects/matieres`, `SubjectManager` — the plain subject-name
CRUD described above), `groupes` (`/admin/subjects/groupes`, `GroupeManager` — same CRUD shape, no import
feature), `matieresClasses` (`/admin/subjects/matieres-classes`, `SubjectClasseManager` — dual-list
assign/unassign of subjects to one classe, editing `coef`/`groupe_id`, with a "copy to other classes of the
same level" dialog backed by `SubjectController::calquerSubjects`), and `matieresCompetences`
(`/admin/subjects/matieres-competences`, `SubjectCompetenceManager` — see below).

**A classe is "APC" (competence-based) indirectly, never via its own column.** The backend's `apc_level`
table is keyed by `(sy_id, section_id, level)`, not by `classe_id` — so being competence-based is a trait of
every classe *at that level*, shared across the whole level, not a per-classe flag. `ClasseReader.fetchApcLevels
(accessToken, connection, year, section)` (`GET /api/classes/getAPCLevels`) returns `ApcLevel[]`
(`{level, activated}`); `ClasseManager` builds a `Map<number, boolean>` from it and exposes
`isLevelApc(level) => apcLevels.get(level) === true` — reuse this exact `fetchApcLevels` +
`Map<level, boolean>` + `isLevelApc` pattern (not a new endpoint or a per-classe field) anywhere else "is this
classe competence-based?" needs answering. `ClasseManager` also lets ADMIN toggle it per level
(`ClasseReader.updateApcLevel`, `POST /api/classes/updateApcLevel` — toggling affects every classe at that
level at once, confirmed intentional, not a bug) and shows an APC yes/no column/select per row driven by the
same map. 404 from `fetchApcLevels`/`fetchClasses` means "nothing yet for this year+section" (empty state),
not a fetch failure — handled the same way both places.

`SubjectCompetenceManager` (`matieresCompetences`) is the one screen that actually *filters* on this: it loads
`ClasseReader.fetchClasses` + `ClasseReader.fetchApcLevels` together, keeps only the classes whose `level` is
`isLevelApc`-true, and only those are selectable in its classe `<select>` (defaulting to the first one) — a
classe whose level isn't flagged competence-based never appears here. Once a classe is selected,
`SubjectReader.fetchSubjectsOfClasse` (the same call `SubjectClasseManager`'s right panel uses,
`GET /api/subjects/subjectOfClasse`) populates the subject `<select>` with that classe's assigned subjects for
the current year (defaulting to the first one) — there's no separate "subjects of an APC classe" endpoint.
Term is a plain hardcoded `1 | 2 | 3` (`TERMS` constant), same "no backend-driven list" precedent as `section`'s
francophone/anglophone radio elsewhere in the app — default term is 1. Competences for the current
(classe, subject, term) come from `SubjectReader.fetchCompetences` (`GET /api/subjects/allCompetences1`,
scoped to exactly that 4-tuple plus section/year — not `allCompetences`/`allCompetencesOfSection`, which are
broader section-wide listings unused by this screen).

**Duplicate `competence_text` is a client-side rule, not a backend one.** Unlike Filiere/Speciality/Classe/
Subject names, `subject_competences.competence_text` has no DB uniqueness constraint and
`SubjectController::saveCompetence`/`updateACompetence` perform no duplicate check server-side — so
`SubjectCompetenceManager` checks the *already-loaded* competences list for the current (classe, subject,
term, section, year) itself (case-insensitive, trimmed comparison) before calling `saveCompetence`/
`updateCompetences`, showing a `"warning"` toast and skipping the request entirely on a match, rather than
relying on `isDuplicateNameError`-style backend error parsing. This is safe specifically because the loaded
list is already scoped to the same uniqueness key the business rule cares about
(`classe_id, sy_id, term_id, subject_id, section_id`) — don't reuse this same-page-list check for a field whose
uniqueness scope isn't identical to what's currently loaded.

The classe-level delete icon (trash button next to the classe `<select>`, tooltip
`"Delete all competencies of {classe_name}"`) calls `SubjectReader.deleteCompetencesOfAClasse`
(`DELETE /api/subjects/deleteCompetencesOfAClasse`, connection+year+classe_id only) — this wipes every
competence of that classe **across every subject and term**, not just the currently-selected subject/term, so
it's deliberately separate from the row-level multi-select delete (`SubjectReader.deleteCompetences` →
`POST /api/subjects/deleteManyCompetences`) which only affects the checked rows of the current
(classe, subject, term) list. Competence text is validated/sanitized with `sanitizeSubjectTitle`
(`src/utils/subjectImport.ts` — the same regex the Excel subject-import path and `GroupeManager` already use,
not `sanitizeFiliereOrSpecialityName`) and capped at `MAX_COMPETENCE_TEXT_LENGTH` (300, `src/utils/
textValidation.ts`). No Print/Export and no "copy competences to other classes of the same level" feature was
built here even though the backend has endpoints for the latter (`calquerCompetences`/
`calquerCompetencesOfTerm`, mirroring `SubjectClasseManager`'s `calquerSubjects` copy dialog) — only
add them if/when explicitly requested, following `SubjectClasseManager`'s copy-dialog pattern rather than
inventing a new one.

**"Delete competences with no marks" toolbox button** (`Eraser` icon, `handleDeleteWithNoMarks`) — like
`deleteCompetencesOfAClasse` above, scoped to the current (classe, subject, term) list, not the whole classe.
`SubjectController::deleteCompetencesWithNoMarks` (`DELETE /api/subjects/deleteCompetencesWithNoMarks`)
deletes whatever ids it's given without itself deciding what "no marks" means (its own docblock says so) — so
the filtering happens client-side first: for every loaded competence, `MarkReader.fetchCompMarks` is called
and a competence is kept as a deletion candidate only if every returned row has `isEmpty === 1` (or there are
no rows at all) — a row can already exist with `isEmpty: 1` from a prior Mark-entry Save/Clear-all without
that meaning a real mark was ever entered, same "isEmpty is the truth, not row-existence" precedent
`MarkEntryManager` itself relies on. A warning toast fires if nothing qualifies; otherwise a confirm dialog
shows the count before the actual delete call.

**Backend bug fixed as part of this feature**: `deleteCompetencesWithNoMarks` ran a bare
`DELETE FROM subject_competences WHERE subject_competence_id = ?` with no cleanup of `stud_comp_mark` first —
unlike its siblings `deleteACompetence`/`deleteManyCompetences`, which both delete the competence's
`stud_comp_mark` rows before deleting the competence itself. Since `stud_comp_mark.subject_competence_id` has
a FK constraint back to `subject_competences`, this meant the delete call failed with a 1451 integrity-
constraint-violation error (surfaced to the user as a generic failure toast) for *any* competence that still
had even a leftover `isEmpty=1` placeholder row — i.e. almost exactly the set of competences this button
exists to clean up, since visiting Mark entry for that (classe, subject, term) even once without typing
anything is enough to create one. Fixed (confirmed via direct `curl` reproduction against the live XAMPP
backend, before/after) to mirror the sibling methods' delete-children-then-parent order, plus an added
server-side safety check — re-querying for a genuine `isEmpty=0` row per id and refusing to delete (reporting
it in the failure message) rather than trusting the caller's own pre-check alone, since this is the one
competence-delete route whose entire contract is "never touch real marks."

### Students (`/admin/students`, `src/components/admin/student/StudentManager.tsx`)

Classe-scoped like `SubjectClasseManager`/`SubjectCompetenceManager` (a classe `<select>`, defaulting to the
first classe of the section, drives everything below it) — but unlike those, "Students" reads a **basic
CRUD roster reference screenshot from a different, legacy app design**, not this app's own prior conventions,
so several things it showed had to be reconciled or explicitly descoped after discussion:

- **`repeating`/`cas_social` need two endpoints merged.** `StudentController::allStudentsOfClasse` (backing
  `StudentReader.fetchStudentsOfClasse`) hardcodes `repeating`/`cas_social` to `0` in its `SELECT` — they're
  placeholder columns there, not real data. The real values live on the `student_classe` pivot, returned by
  `allStudClassOfAClasse` (`StudentReader.fetchStudentClasseOfClasse`). `StudentManager.loadStudents` fetches
  both in parallel and merges the pivot's `repeating`/`cas_social` onto each `Student` row by `stud_id` before
  rendering — never trust `repeating`/`cas_social` straight off `fetchStudentsOfClasse` alone.
- **No parent/phone linkage.** The reference screenshot has a "Phone" filter, but `Student` has no phone
  column — phone would live on `StudParent` (`p_id`), and there is **no backend support for it at all**: no
  `StudParentController`, no routes, nothing (confirmed by grepping the whole `app/Http/Controllers`
  directory). `setFatherMother` is unrelated — it just writes plain father/mother name text onto
  `student.st1`/`student.str2`, no phone involved. Building real parent+phone linkage is a separate, future
  backend-first task (a whole new controller/routes/CRUD, mirroring Staff's account-linkage pattern) — this
  screen has no Phone filter/column and doesn't touch `StudParent`.
- **Matricule generation is pure client-side, per the school's own numbering convention** —
  `src/utils/matricule.ts`'s `generateUniqueMatricule(schoolYear, classeName, section, existingMatricules)`
  builds `{yearPrev}-{cl}{sectionCode}{2 random letters}-{2 random digits}` (e.g. `"2025-6e01BG-47"` for year
  "2025/2026", classe "6ème A", francophone): `yearPrev` is the year string's first half, `cl` is the classe
  name normalized (accents stripped, lowercased) and sliced to 2 chars, `sectionCode` is `"01"`
  francophone/`"02"` anglophone (a fixed literal, not the DB `section_id`). There's no backend endpoint for
  this or for uniqueness-checking it, so "Generate matricule" fetches every student of the *whole year*
  across all classes (`StudentReader.fetchAllStudentsOfYear`, `GET /api/students/allStudents`) fresh on each
  click and regenerates until the candidate isn't already taken — reuse this exact
  fetch-fresh-and-regenerate approach rather than caching the matricule set, since it must reflect students
  added earlier in the same session.
- **Toolbar is Import + Export + Refresh only** — the reference screenshot's ~9 icons (a second PDF-style
  icon, a download icon, an orange lock icon, etc.) were deliberately not all built; only the icons that map
  to this app's existing per-screen conventions were kept. The lock icon in particular was *not* wired to the
  existing `LockController`/`locksOfYear` module — if term-based edit-locking for students is wanted, that's
  new, separate scope.
- **Edit is whole-row**, matching every other manager (`Modifier` toggles the whole row into edit mode via
  `editingFields`/`editingMatricule`), not the reference screenshot's per-cell pencil icons.
- **Import file format** (`src/utils/studentImport.ts`) has a quirk classeImport.ts/staffImport.ts don't:
  the sample sheet's row 1 is a title cell (e.g. `"6e B"` in column A), not the header — `findHeaderRowIndex`
  scans the first few rows for the one whose column B reads `"NOM"` (case/accent-insensitive) rather than
  assuming row 1 is always the header. Columns: A=NO (ignored), B=NOM→name (required, sanitized via
  `sanitizeStudentName` — letters/accents/space/hyphen only, matching `saveAStudent`'s backend regex exactly,
  stricter than `sanitizeSubjectTitle`/`sanitizeStaffText`), C=PRENOM→surname, D=MATRICULE→matricule,
  E=SEXE→sexe, F=DATE NAIS.→bday (handles genuine `Date`-typed xlsx cells via `cellToBday`, plus a
  fallback parse of `M/D/YYYY`/`D-M-YYYY`/ISO strings), G=LIEU NAIS.→bplace, H=REDOUBLE→repeating (lenient:
  only `R`/`OUI`/`O`/`YES`/`1`/`TRUE` count as repeating). The delete-existing-before-import question, like
  Subject/Staff/Classe's import, maps to `saveStudents`'s `override` flag — but note `override` here only
  clears the **selected classe's** roster (`student_classe.classe_id = $classe_id`), not the whole
  section+year like Subject's does, since `StudentController::saveStudents` is classe-scoped by design.
- **Backend bug fixed as part of this module**: `StudentController::updateStudents` validated `year` as
  `required|integer`, but every other student endpoint (and this whole app's convention) sends year as a
  string like `"2025/2026"` — that request would always 422. Confirmed live via `curl` before and after;
  changed to `required|string` in the backend repo. If a similar "all other student endpoints treat X as a
  string but this one doesn't" mismatch shows up elsewhere in `StudentController`, treat it the same way
  (verify with `curl`, then fix) rather than assuming the frontend must adapt to it.
- **Search is one unified box** (name/surname/matricule/bplace substring match), not the reference
  screenshot's multiple discrete filter fields (separate Name/Surname/Phone/birth-day/birth-place/gender/
  matricule/redouble inputs) — matches every other manager's single `searchQuery` convention. The stats bar
  (Filles/Garçons/Total/Redoublants/Nouveaux/Handicapés/Cas social) is computed client-side from the full
  (unfiltered) roster, not the search-narrowed one, so searching for one student doesn't change the header
  counts. "Nouveaux" is simply `Total - Redoublants` — there's no separate "new admission" flag in the data
  model to distinguish it any other way.

### Export to CSV/PDF (`src/utils/exportData.ts`, `src/components/sharedcomp/ExportButtons.tsx`)

All five admin CRUD screens above render `<ExportButtons onExportExcel={...} onExportPdf={...} .../>` above
their table, disabled while loading or empty. `exportRowsToCsv(filename, columns, rows)` builds a plain
UTF-8-BOM `.csv` client-side (not a real `.xlsx`) — deliberate: the npm `xlsx`/SheetJS package carries open,
unpatched high-severity advisories, and this data has no formatting/multi-sheet need that would justify it;
Excel opens `.csv` natively and the BOM keeps accented characters intact. `exportRowsToPdf(title, filename,
columns, rows)` dynamically `import()`s `jspdf`/`jspdf-autotable` (keeps them out of the main bundle) and
renders a simple titled table. Both take an `ExportColumn<T>[]` (`{header, accessor: (row: T) => string |
number}`) — reuse this exact shape for a new screen's export rather than writing a bespoke CSV/PDF builder.
`buildTimestampedFilename(title, extraSegments, extension)` builds every export filename in the app (CSV and
PDF alike, plus any bespoke document like `EffectifsManager`'s report or `CourseAssignmentManager`'s print) in
one fixed, human-readable format: `"<Title> - <extra segment> - ... - yyyy mm dd hh mm ss.<ext>"` — e.g.
`buildTimestampedFilename("Liste de classes", ["Section Francophone"], "pdf")` →
`"Liste de classes - Section Francophone - 2026 07 18 14 30 05.pdf"`. Unlike a generic sanitizer, it only
targets characters actually invalid in a **Windows** filename (`\ / : * ? " < > |`) — the deployed target,
not just whatever the dev's own OS happens to tolerate — and replaces each one with a literal space rather
than stripping or underscoring it, so e.g. a "copy to other classes" title built from multiple classe names
joined by `/` (`"4e ALL/4e ARA'B"`) still reads as separate words (`"4e ALL 4e ARA'B"`) instead of running
together; it deliberately preserves spaces, dashes, and accented letters — the format depends on them.
`extraSegments` are already-labeled strings in
display order (`` `Section ${capitalizeSectionName(section)}` ``, `` `Classe ${classe_name}` ``,
`` `Section ${capitalizeSectionName(section)}` `` again for staff-per-teacher exports, ...); pass `[]` for a
screen whose export isn't scoped to anything beyond its title (Staff — not section-scoped; the whole-school
`EffectifsManager` report — covers every section at once). `capitalizeSectionName(section)` title-cases the
raw lowercase `"francophone"/"anglophone"` value for this display purpose only — every other place in the app
(e.g. `sectionHint` text) still shows the raw lowercase value; don't use it there. The literal title strings
(`"Liste du personnel"`, `"Liste de classes"`, `"Liste des matières"`, `"Liste des filière"` — singular,
matching the exact wording requested, not "filières" — `"Liste des specialités"` — without the accent on the
first e, likewise exact — `"Liste des attributions"`, `"Liste des groupes"`, `"Liste des élèves"`,
`"Effectifs par classe"`) are hardcoded in each screen's `handleExportExcel`/`handleExportPdf`, independent of
the app's own FR/EN language toggle — this naming format was specified as fixed text, not translated content,
same precedent as `exportHeader.ts`'s bilingual government letterhead being fixed regardless of the language
toggle.

Every PDF export (`exportRowsToPdf` and every bespoke builder like `CourseAssignmentManager`'s Print and
`exportEffectifsToPdf`) also ends with a signature block via `exportHeader.ts`'s `drawPdfSignature(doc,
schoolHeader, currentY)`: `Fait à **{lieu_signature}**, le **{date_signature}**` followed by bold
`Le {responsableFr}` / italic `The {responsableEn}`, positioned right-of-center below the last content block
(pushed to a new page if it would collide with the footer rule). `responsableFr`/`en` are computed from the
school config's own `type` column via `computeResponsable()` (see School basic info below) rather than
trusting `sessionStorage`, so the signature is always correct for the school actually being exported, not
whichever browser tab last visited `/admin/school-info`. It draws nothing if the config has neither a
signature place nor date set. `exportRowsToPdf` takes an `includeSignature = true` param to opt out — reserved
for the future report-card/bulletin/livret exporters, which will use their own print layout and shouldn't get
this generic block; no caller passes `false` yet.

Every PDF export also gets a faint, centered, full-page **school-logo watermark** via `exportHeader.ts`'s
`drawPdfWatermark(doc, header)` (8% opacity, 60% of page width, height derived from the logo's own natural
aspect ratio so it isn't stretched) — deliberately implemented as part of `drawPdfFooters(doc, header?)` rather
than as a separate call each export has to remember to make: `drawPdfFooters` is the one call every PDF export
in the app already makes exactly once at the very end, looping over every page via `doc.setPage(page)` after
`autoTable` has finished paginating (this is also what lets the watermark reach pages `jspdf-autotable` adds
internally on overflow, which nothing else in the app has a hook into). Because it piggybacks on that same
final pass, the watermark is necessarily drawn **on top of** each page's existing content rather than truly
behind it (jsPDF's content stream is append-only — an earlier "draw it first, before the table" approach would
need a hook into every page-creation path, including autoTable's internal ones); at 8% opacity via
`doc.saveGraphicsState()`/`doc.setGState(doc.GState({opacity}))`/`doc.restoreGraphicsState()` this reads the
same as a traditional behind-content watermark. Every existing `drawPdfFooters` call site was updated to pass
its already-in-scope `schoolHeader` (every one of them already had it, for the letterhead/signature); the
param is optional only because `exportRowsToPdf`'s own `schoolHeader` param is optional, and a caller with no
header at all still gets a plain footer with no watermark, matching `drawPdfLetterhead`/`drawPdfSignature`'s
own "draw nothing without a header" fallback. `drawPdfWatermark` draws nothing if `header.logoImage` is still
null (loading, or no logo configured for this school) — same convention as the letterhead's own logo. **Not**
applied to `src/utils/exportMarkSheets.ts`'s `exportMarkSheetsToPdf` ("Fiches de report de notes" blank paper
forms) — that exporter was deliberately built with no letterhead/signature/footer at all per an earlier
explicit request (it's a working paper meant to be filled in by hand and transcribed later, not an official
document), and it isn't wired into any screen yet (`MarkSheetManager.tsx` exists but nothing imports
`exportMarkSheetsToPdf`) — revisit whether it should get the watermark once that module is actually built out.

Student's PDF export is one deviation worth knowing: it prepends a row-index (`Nº`) column via a
`pdfExportColumns` array that isn't shared with the CSV export (CSV relies on the spreadsheet's own implicit
row numbers) — follow this same PDF-only-Nº-column split if another screen's PDF export needs a visible index
the CSV doesn't.

### Assign courses (`/admin/course-assignment`, `src/components/admin/courseassignment/CourseAssignmentManager.tsx`)

Two dropdowns drive the whole screen: staff (alphabetically sorted, `formatStaffLabel` renders `"Name Surname
(staff_id)"` to disambiguate same-named teachers, defaulting to the first) and subject (defaulting to the
first), both scoped to `connection`/`schoolYear`/`section`. `StaffReader.fetchAllAttributionsOfSection`
(`GET /api/staffs/AllAttributionsOfSection`) is fetched once and cached, then reused for **both** panels
(filtered client-side by subject+classe for the left panel, by staff for the right) rather than making
narrower per-selection requests — refetched after every mutation.

- **Left panel** — classes teaching the selected subject (`ClasseReader.fetchClassesOfSubject`,
  `GET /api/classes/allClassesOfSubject`), each annotated with the names of other teachers (excluding the
  selected one) already assigned to that subject+classe, derived from the cached attributions.
- **Right panel** — every assignment (Nº/Classe/Subject/Action) the *selected teacher* has across every
  subject, not just the selected one; a classe can repeat across rows if the teacher teaches multiple subjects
  there. Per-row delete icon plus checkbox multi-select with a confirm-gated bulk delete, same
  `useConfirm()`/`showToast()` conventions as every other manager.
- **Print** — a bespoke multi-table PDF (not `exportRowsToPdf`, same reasoning as `exportEffectifsToPdf`:
  the generic exporter only renders one flat table) grouping every assignment of the whole section+year by
  classe, still reusing `drawPdfLetterhead`/`drawPdfSignature`/`drawPdfFooters` for the shared
  letterhead/signature/footer.
- **Export to Excel** exports only the currently-displayed right panel (the selected teacher's rows) via the
  normal `exportRowsToCsv`/`ExportColumn<T>` shape — deliberately narrower scope than Print, which always
  covers the whole section.
- **Wipe section** — a red button clearing every assignment of the current section+year (double-confirmed).
  No dedicated backend endpoint exists for this, so it composes the existing bulk `StaffReader.batchRemoveCourses`
  endpoint over the full cached attributions list rather than requesting a new backend route — the same
  "compose existing bulk endpoints client-side" pattern `SubjectClasseManager`'s Copy dialog uses via
  `calquerSubjects`.

### Student photo (`StudentPhotoCell.tsx`/`StudentPhotoDialog.tsx`, inside `src/components/admin/student/`)

A 40px clickable thumbnail column in `StudentManager`'s table, opening a dialog to view/rotate/zoom-pan/save.
`student.photo` turned out to already be a `mediumblob` column (confirmed live via `SHOW COLUMNS FROM
student`) — unused until this feature, but the schema had clearly anticipated DB-stored binary bytes rather
than a filesystem convention like the school logo's `public/images/{connection}/logo/...`. Storing there
avoids a new per-connection folder/collision scheme and keeps each photo inside that school's own DB
backup/restore boundary, so **new photo-adjacent features should keep using this column**, not invent a
filesystem path.

- Backend: `StudentController::uploadStudentPhoto` (ADMIN, `POST /api/students/uploadStudentPhoto`,
  multipart, `photo` validated `image|mimes:jpeg,png,jpg|max:500` — 500KB, same unit convention as the logo's
  `max:2048`) and `StudentController::studentPhoto` (any authenticated role, `GET
  /api/students/studentPhoto`, streams the raw bytes with a hardcoded `Content-Type: image/jpeg` since the
  frontend always re-encodes to JPEG before upload; 404 JSON when the student has no photo yet, mirroring
  `schoolLogo`'s convention).
- `StudentReader.loadStudentPhotoImage` mirrors `SchoolInfoReader.loadLogoImageForExport`'s fetch-as-Blob →
  `URL.createObjectURL` → `Image()` pattern exactly — there's no static path for a DB blob, so every read goes
  through the authenticated endpoint. It already returns a canvas-ready `HTMLImageElement`, so a future
  report-card PDF exporter can reuse it with no new plumbing, the same way `drawPdfLetterhead` already reuses
  the logo's `HTMLImageElement`.
- `StudentPhotoCell` loads its own photo independently per row (its own `useEffect` + `cancelled` guard, same
  shape as `useSchoolHeader.ts`) so a slow/missing photo never delays the table or any other row — showing the
  `UserRound` placeholder immediately and swapping in the real image once it resolves *is* the
  "load asynchronously" behavior; there's no separate loading spinner state. Follow this same
  one-component-per-row pattern for any other per-row async asset.
- `StudentPhotoDialog`'s canvas editor (fixed 480×480 internal resolution, ~260px on-screen) supports rotate
  (±90° buttons), zoom (range slider), and drag-to-pan. Save flattens the canvas via `canvas.toBlob(...,
  "image/jpeg", quality)`, stepping quality down (`0.85 → 0.7 → 0.55 → 0.4 → 0.25`) until the result is under
  500KB before uploading, so the client-side output always already satisfies the backend's `max:500` rule.
- `photoVersions` (a `Record<stud_id, number>` in `StudentManager`, bumped only for the saved student) is how
  a save signals just one row's `StudentPhotoCell` to refetch, instead of reloading the whole list.

### Effectifs par classe (`/admin/effectifs`, `src/components/admin/effectifs/EffectifsManager.tsx`)

A read-only, whole-school report replicating a paper "EFFECTIFS PAR CLASSE" statement (classe-by-classe
headcounts grouped by cycle and section) — no CRUD, no edit-in-row, unlike every other admin screen; its
only actions are "Actualiser" (refetch) and the two `ExportButtons`. Wired to the dashboard's previously-inert
"Bilan" (`summary`) `AdminMenuGrid` card. Content is hardcoded French only (no per-file translation
dictionary added to `src/i18n/translations.ts`), by explicit request — the one exception to this app's usual
per-screen-dictionary convention.

- **Always both sections, never scoped to `useAuth().section`.** Unlike every classe-scoped screen
  (`ClasseManager`, `StudentManager`, ...), this report always fetches and renders **both**
  francophone and anglophone (a school-wide statement isn't meaningful scoped to whichever section
  happens to be selected in `TopBanner`) — it only reads `connection`/`schoolYear`/`accessToken` from
  `useAuth()`, not `section`. A section is dropped entirely (not rendered as an empty table) only when it
  has **zero classes** for the year (`ClasseReader.fetchClasses` 404/empty) — a section with classes but zero
  enrolled students still renders its full classe list with all-zero counts, matching the reference report.
- **`StudentController::allStudentsSummaryOfSection`** (`GET /api/students/allStudentsSummaryOfSection`,
  `StudentReader.fetchStudentsSummaryOfSection`) is a new backend endpoint added for this report — returns
  one flat row (`sexe`, `repeating`, `classe_id`, `classe_name`, `level`) per enrolled student across an
  **entire section** in a single query (join across `student`/`student_classe`/`classe`/`classe_year`),
  ordered by `level, classe_name`. Deliberately takes `section` as the literal francophone/anglophone string
  (via `MyHelper::getSectionID($section)`), the same convention as `allClasse1`/`getAPCLevels`/
  `fetchClasses`, **not** `section_id` like the pre-existing, differently-shaped
  `allStudentsOfClasseOfSection` (which returns full `Student` columns for one already-resolved
  `section_id`, not this report's minimal per-student tally shape). Chosen over looping
  `fetchStudentsOfClasse`+`fetchStudentClasseOfClasse` per classe (the pattern `StudentManager` uses) because
  a whole-section report would mean 2×N requests for N classes; this is 1 request per section instead.
- **`src/utils/effectifs.ts`** is the pure computation layer, independent of the fetch/render code so it's
  unit-testable in isolation: `cycleOfLevel(level)` — **Cycle 1 = levels 1-4 (6ème..3ème), Cycle 2 = levels
  5-7 (2nde..Tle)**, per the report's own convention (not `computeMaxClasseLevel`'s CES/short-cycle
  distinction, which is a different, unrelated cutoff) — `buildClasseEffectifs(classes, summaryRows)` merges
  the full classe list (including zero-student classes) with the flat summary rows by `classe_id` into one
  row per classe (`garcons`/`filles`/`redoublants`/`nouveaux`/`total`; `nouveaux` is `total - redoublants`,
  the same simplification `StudentManager`'s stats bar already uses — no separate "new admission" flag
  exists in the data model), then `groupByCycle`/`buildSectionEffectif`/`sumSections` roll those up into
  cycle subtotals, a section subtotal, and a grand total across every section.
- **`src/utils/exportEffectifs.ts`'s `exportEffectifsToPdf`** is a bespoke PDF builder, not a caller of
  `exportData.ts`'s generic `exportRowsToPdf` — that generic exporter only knows how to render one flat
  table, whereas this report needs one table per section with an interleaved bold "RÉSUMÉ DU CYCLE n"
  subtotal row (light-gray fill) after each cycle's classe rows, a black/white "Bilan section: x" row at
  each section's end, and a final black/white "BILAN" row across every section — built via
  `jspdf-autotable`'s per-cell `{content, colSpan, styles}` object shape (`CellDef`) rather than
  `didParseCell` hooks. It still reuses `exportHeader.ts`'s existing `drawPdfLetterhead`/`drawPdfSignature`/
  `drawPdfFooters` (the same bilingual government letterhead + "Fait à.../Le {Directeur|Proviseur}"
  signature block + footer every other screen's PDF export already gets) rather than inventing new
  letterhead code — only the body table layout is bespoke here.
- **CSV export** (`ExportButtons`' Excel button) still goes through the existing generic
  `exportRowsToCsv`/`ExportColumn<T>` shape from `exportData.ts`, flattened to one row per classe (with a
  `Section`/`Cycle` column added) via a local `buildFlatRows` helper in `EffectifsManager.tsx` — CSV has no
  need for the PDF's grouped/subtotal layout, matching `exportRowsToCsv`'s existing "raw tabular data" role
  everywhere else in the app.

### Mark entry (`/admin/mark-entry`, `src/components/admin/marks/MarkEntryManager.tsx`)

Classe/subject/term-scoped like `SubjectCompetenceManager`, but the whole screen branches into **two
independent modes** off the same `isLevelApc(level)` check `ClasseManager`/`SubjectCompetenceManager` already
use (see "Subjects hub and the APC / competence-based classe concept" above) — a classe's level, not the
classe itself, decides which mode applies:

- **Non-APC** — a Sequence `<select>` (1 or 2) is shown; marks live in `student_subject`, keyed by a derived
  `dbsequence` in `[1..6]`: `dbsequence = (term - 1) * 2 + sequence` (`computeDbSequence` in
  `MarkEntryManager.tsx`). Read/written via `MarkReader.fetchSeqMarks`/`saveSeqMarks` →
  `GET/POST api/students/{getSeqMarks,saveSeqMarks}`.
- **APC** — the Sequence `<select>` is replaced by a Competence `<select>` (`SubjectReader.fetchCompetences`
  for the selected subject+term, defaulting to the first). Marks live in `stud_comp_mark`, keyed by
  `(term_id, subject_competence_id)`. Read/written via `MarkReader.fetchCompMarks`/`saveCompMarks` →
  `GET/POST api/students/{getCompMarks,saveCompMarks}`. A level flagged APC with zero competences defined yet
  for the selected subject+term hides the whole roster/save UI in favor of an empty-state message rather than
  letting the user type into a table with nothing to save against.

**`StudentController::allStudentsForMarks` is not actually classe-scoped** despite its own comment claiming
otherwise (no `classe_id` filter in the query — it returns every student of the whole school year) — this
screen deliberately reuses the already-correct `StudentReader.fetchStudentsOfClasse` for the roster instead
of that endpoint.

**Locking is genuinely global, not per-classe/subject** — `lock_sequence` is keyed only by `(sy_id, seq)`, so
the Lock/Unlock button (`MarkReader.fetchLocksOfYear`/`saveLock` → `api/lock/{locksOfYear,saveOrUpdateLocks}`)
locks that `seq` for every classe and subject at once, by design. Since `seq` has no APC/non-APC axis, APC
classes reuse the term id (1-3) as `seq` and non-APC classes use the dbsequence (1-6) — a school mixing APC
and non-APC classes in the same year could see e.g. a term-1 APC lock collide with a dbsequence-1 non-APC
lock (`effectiveLockSeq` in `MarkEntryManager.tsx`). This is an inherited backend modeling gap, not something
papered over here.

**Every mark is displayed and stored as `"XX.YY"`** — a fixed 2-digit-integer/2-digit-decimal string (e.g.
`5` → `"05.00"`, `12.5` → `"12.50"`), via `src/utils/textValidation.ts`'s `formatMarkValue`. This is applied
in three places, all funneling through the same `commitMarkFormat` helper for the latter two: once when a
mark is freshly fetched from the server (`loadMarks`, wrapping the raw numeric value), and again "when the
user is done editing this cell" — on blur and on pressing Enter (`handleMarkKeyDown`) — reformatting whatever
they typed. While actively typing, the cell instead holds `sanitizeMarkInput`'s raw in-progress string (digits
+ at most one decimal point, immediately dropping the newest keystroke if it would push the value out of
`[0, MAX_MARK_VALUE]` — see `sanitizeMarkInput`/`isMarkInRange` in `textValidation.ts`) so a partial value like
`"2"` isn't rejected as too short to be `"20"`; `formatMarkValue` only runs once editing is confirmed done, not
on every keystroke.

Keyboard navigation: `markInputRefs` (a `Map<stud_id, HTMLInputElement>`, populated/cleared by each mark
input's own ref callback as `filteredRoster` changes which rows are mounted) lets ArrowUp/ArrowDown jump focus
directly to the same column in the previous/next *visible* row (respecting the active search filter) without
requiring a mouse click, in addition to Enter committing the format and staying on the same cell.

The right-side fill-rate panel (`Visualiser le remplissage des notes de '{classe_name}'`) has no backend
endpoint to pre-aggregate it — it's computed client-side, per subject, via a `Promise.all`: non-APC compares
`fetchSeqMarks`' filled-row count against roster size; APC fetches that subject's competences and averages
each competence's own fill rate (confirmed convention — not a single combined query).

The "Clear all marks" action (broom/`Eraser` icon) is confirm-gated (`useConfirm()`) like every other
destructive action in this app, but — unlike a plain local-buffer clear — persists immediately on confirm: it
builds an `isEmpty: 1` row for every currently-visible (filtered) student and calls the same
`saveSeqMarks`/`saveCompMarks` path Save uses.

Unlike every list-based CRUD manager above, the mark grid has **no per-row Modifier/Enregistrer toggle** —
every mark cell is always directly editable, with one global Save (floppy icon) button collecting every dirty
row into a single bulk write. With 30-60 students per classe, a per-row edit-toggle would make the common
"enter marks for the whole roster" case far more tedious, and this was a deliberate, confirmed departure from
the rest of the app's inline-edit convention rather than an oversight.

**Fill-rate PDF export and chart** — a `Download` icon next to the fill-rate panel heading exports its
current per-subject list to PDF via the existing generic `exportRowsToPdf`; a `BarChart3` icon opens
`FillRateChartDialog.tsx` (same native-`<dialog>` pattern as `TopBanner`'s dialogs), which renders that same
data as a Bar or Pie view with no charting library added — Bar is plain width-percentage `<div>`s, Pie is a
CSS `conic-gradient` (slice size = each subject's share of the summed rates) with a color-keyed legend.

**Offline-safe mark export/import** — three toolbar buttons address a teacher losing connectivity or hitting
a server error mid-entry:

- `FileDown` **exports the currently-displayed marks** (selected classe/subject/term/sequence-or-competence)
  to CSV via `exportRowsToCsv`, columns `# / stud_id / matricule / Name / Mark/20` (the `Mark/20` cell is the
  mark re-parsed to a plain `Number`, not the displayed `"XX.YY"` string, so a round-trip import doesn't carry
  a misleading `.00`). Always the full `roster`, never `filteredRoster` — matches every other manager's
  "export ignores the active search filter" convention.
- `FileSpreadsheet` **exports every subject's marks at once** to a genuine multi-sheet `.xlsx` workbook
  (`src/utils/exportMarksWorkbook.ts`'s `exportMarksWorkbookToXlsx`) for the current term (+ sequence for
  non-APC): one worksheet per subject, same 5-column shape as the single-subject CSV. For an APC classe, a
  subject alone isn't a complete key (marks also need a competence), so it's one worksheet per
  **(subject, competence)** pair instead, fetched via a nested `Promise.all` over
  `SubjectReader.fetchCompetences` then `MarkReader.fetchCompMarks`; a subject with zero competences defined
  for the current term is simply skipped, same as `apcHasNoCompetence` elsewhere on this screen.
  `buildUniqueSheetName` sanitizes/truncates each sheet name to Excel's 31-char, no-`\/*?:[]`-character
  worksheet-name rules and dedupes collisions with a `" (2)"`/`" (3)"` suffix. This uses **`exceljs`**
  (already a dependency, the same library every `*Import.ts` reader already uses to parse `.xlsx` on the way
  in) to *write* the workbook — a different library from the npm `xlsx`/SheetJS package the Export-to-CSV/PDF
  section above documents avoiding for its unpatched advisories; a real multi-sheet file has no CSV
  equivalent, so this is the one export in the app that produces a `.xlsx` rather than a `.csv`.
- `Upload` **imports marks** from a `.csv` or `.xlsx` file shaped like the single-subject export
  (`src/utils/markImport.ts`'s `parseMarkImportFile`) back into the currently-selected subject/term/
  sequence-or-competence. Only columns C (`matricule`) and E (`Mark/20`) are read, starting at row 2; each
  matricule is resolved against the already-loaded `roster` (the file's own `stud_id`/`Name` columns are
  never trusted back), and each mark must be empty or in `[0, 20]`. Parsing aborts on the **first** invalid
  row with a specific "row N, matricule X" message (same all-or-nothing precedent as `studentImport.ts`/
  `classeImport.ts`, not an accumulate-every-error report). A valid file still requires
  `useConfirm()`-accepting an explicit "this REPLACES every existing mark for this subject+period" warning
  before `saveSeqMarks`/`saveCompMarks` actually runs. Legacy binary **`.xls` is deliberately not
  supported** — `ExcelJS` only reads `.xlsx`, and every other importer in this app has the same gap for the
  same reason (adding the full `xlsx`/SheetJS package just to cover `.xls` would reintroduce the advisories
  noted above); selecting one shows a clear unsupported-format toast rather than failing silently.

**Whole-section "Notes trim N" PDF report** (`FileText` toolbar icon, `handleExportAllClassesMarks`,
`src/utils/exportAllMarksReport.ts`'s `exportAllMarksReportToPdf`) — unlike every other export on this screen
(all scoped to the single selected classe), this one is scoped like `EffectifsManager`'s report: **every
classe of the current section** (`classes`, already loaded), for the currently selected `selectedTerm`, into
one downloaded PDF. For each classe it independently re-fetches that classe's own subjects
(`SubjectReader.fetchSubjectsOfClasse`) and roster (`StudentReader.fetchStudentsOfClasse`) rather than reusing
the single-selected-classe `subjects`/`roster` state; a classe with an empty roster is skipped entirely (no
blank block), and — same `apcHasNoCompetence` precedent as elsewhere on this screen — an APC subject with zero
competences defined for the current term is skipped rather than emitting an empty table.

- **Bespoke PDF builder, not `exportRowsToPdf`** (same reasoning as `exportEffectifsToPdf`: the generic
  exporter only knows one flat table). `exportAllMarksReportToPdf` draws the shared letterhead once
  (`drawPdfLetterhead`) on a cover page titled `"NOTES DU {ORDINAL} TRIMESTRE"` + `"Année Scolaire: {year}"`,
  then gives **every (classe, subject) block its own fresh page** (`doc.addPage()` before each `autoTable`
  call) — a deliberate deviation from `exportEffectifsToPdf`'s continuous-flow/`finalY`-tracking layout, chosen
  to match the user-provided reference report's own observed pagination (a new subject's block always starts a
  fresh page, even when the previous table had room to spare). Each page's own small header line reads
  `Classe: {classe_name}` (left) / `Matière: {subject_title}` (right) above the table
  (`NO. / NOM ET PRÉNOM / ...`), and the whole document ends with the standard `drawPdfSignature` +
  `drawPdfFooters` (page-numbered footer), same as every other PDF export in the app.
- **Column headers differ by classe type, per explicit request**: non-APC classes always get the two literal
  columns `NOTE1`/`NOTE2` (the term's two sequences, `computeDbSequence(selectedTerm, 1/2)` via
  `fetchSeqMarks`); APC classes get one column per subject-competence, labeled **`Comp. 1`, `Comp. 2`, ...**
  rather than the competence's own text — the same reasoning `SubjectCompetenceManager`'s competence `<select>`
  already truncates long competence text for, but here the header is fully replaced by the numbered label
  rather than truncated, since a wide multi-column table has even less room per header than a dropdown option.
- **Mark values are raw numbers** (`formatReportMarkValue`: `String(Number(mark))`, `""` for an empty/unset
  mark) — not the on-screen zero-padded `"XX.YY"` display format (`formatMarkValue`), matching the reference
  report's own plain `"16.5"`/`"20"` styling.
- **Filename** goes through the same `buildTimestampedFilename(\`Notes trim ${selectedTerm}\`, [\`Section
  ${capitalizeSectionName(section)}\`], "pdf")` helper every other export in the app uses — deliberately *not*
  the literal `"...2026-7-19 14h 43m 43s"` timestamp format from the original feature request, to stay
  consistent with this app's one existing timestamp convention (`"yyyy mm dd hh mm ss"`, space-separated)
  rather than introducing a second one.
- Guarded by its own `isExportingReport` loading flag (folded into the existing `{(isSaving || isExportingAll
  || isExportingReport) && <LoadingOverlay />}` condition) since the fetch loop is potentially heavy — every
  classe × subject (× competence, for APC) of the whole section, sequentially per classe to avoid firing every
  request at once. A `t.exportAllClassesMarksEmpty` warning toast covers both "no classes in this section" and
  "every classe/subject was skipped" (empty rosters, or every APC subject having zero competences this term).

### School basic info (`/admin/school-info`, `src/components/admin/schoolinfo/SchoolInfoManager.tsx`)

Unlike the five list-based CRUD screens above, this is a single-record form backing the "Information de base"
dashboard card — one row per (connection, school year) in the backend's `basic_school_config` table.

- **`SchoolInfoReader.fetchSchoolConfigOfYear(accessToken, connection, year)`** (`src/dbmanger/
  SchoolInfoReader.tsx`) hits `GET api/configs/allSchoolConfigOfYear` and returns the raw first row (or
  `null`) typed as `SchoolHeaderConfig` (`src/interfaces/SchoolHeaderConfig.tsx`) — snake_case DB columns,
  intentionally *not* remapped to a local convention since it's also consumed as-is elsewhere (the login-time
  header cookie, see Auth section). `SchoolInfoManager` re-runs this fetch every time the screen mounts and
  whenever `connection`/`schoolYear` change, mapping the response onto the form's `SchoolConfig` fields
  (`mapHeaderConfigToFields` — note `str1`/`str2` come back aliased as `ref_transfert`/`ref_document` from the
  backend's raw SQL `SELECT`, and `phone1` can be a `number`, both handled explicitly) so the form always
  reflects the server's current state rather than a stale local draft.
- **`SchoolInfoReader.saveSchoolInfo(accessToken, connection, year, fields, logoFile)`** POSTs
  multipart `FormData` (not JSON, unlike every other `*Reader`) to `api/configs/schoolConfigSorU`, since the
  backend requires the logo as an uploaded file on **every** save — even editing an existing record with an
  existing logo requires re-selecting a file client-side, because the backend controller calls
  `$request->logo->move(...)` unconditionally regardless of whether one was actually provided. The form
  enforces this (blocks submit with `t.logoRequired` if no file is chosen) to avoid tripping that backend
  crash rather than relying on the backend's own (misleading) `nullable` validation rule.
- **`SchoolInfoReader.fetchLogo(connection): Promise<string | null>`** resolves the *current* logo's URL,
  independent of the form/save flow above — reusable from any other module that needs to display the school
  logo (report headers, printed documents, ...). The logo isn't looked up via `logo_path` from
  `basic_school_config` (that column holds a one-off, timestamped upload filename); instead it lives at a
  fixed, well-known path per connection with an unpredictable extension:
  `{baseUrl}public/images/{connection}/logo/logo.{png|jpg|jpeg}` (the `public/` segment is required — Apache's
  docroot here is the Laravel app root, not `public/`, confirmed live). `fetchLogo` probes the three
  extensions via a plain `Image()` `onload`/`onerror` probe, **not** `fetch()` — the images path isn't under
  `api/*`, so it isn't covered by the backend's CORS config, and a real cross-origin `fetch()`/`HEAD` would be
  blocked; loading through an `Image` element sidesteps CORS entirely, same as a plain `<img>` tag.
- **`src/utils/schoolTypes.ts`** exports `SCHOOL_TYPES` (the fixed establishment-type list for the `type`
  `<select>`) and `computeResponsable(type)`, ported from the mobile app's algorithm: CES/ENIEG/CETIC/COLLEGE
  → `{fr: "Directeur", en: "Director"}`, everything else (LYCEE and its variants) →
  `{fr: "Proviseur", en: "Principal"}`. Selecting a type recomputes this and immediately persists it to two
  session variables (see below) — it's informational display only (`Responsable:[...]` under the `<select>`),
  not an editable field.
- **Session variables** (`MyConstants.SCHOOL_TYPE_KEY`/`RESPONSABLE_FR_KEY`/`RESPONSABLE_EN_KEY`, defaults
  `"LYCEE"`/`"Proviseur"`/`"Principal"`) are seeded on first mount if absent and kept in sync with the `type`
  `<select>` — other modules needing "who signs documents for this school" should read these rather than
  recomputing `computeResponsable` themselves.
- **`src/utils/textValidation.ts`'s `sanitizeSchoolInfoText`/`sanitizePhoneNumber`** are this form's own
  character filters (accented-letter/punctuation allowlist for name/address fields, digits-only for phone) —
  deliberately **not** applied to the Email field (a `type="email"` input plus a format regex check on submit
  instead), since the allowlist has no `@` and would make typing a valid address impossible.

### Settings hub and Classified / Not Classified (NC) parameter

`/admin/settings` (`SettingsHub.tsx`) is a landing page for the "settings" `AdminMenuGrid` card, same
`SubjectsHub`/`AccountHub` pattern, currently with a single tile: "Classified / Not Classified (NC) parameter"
(`classifiedParam` → `/admin/settings/classified-param`, `ClassifiedParamManager`). Add further settings
sub-modules here the same way `SubjectsHub`'s other sub-modules were added, rather than growing this one
screen.

`ClassifiedParamManager` is a **single-record radio+slider form**, closer in shape to `SchoolInfoManager` than
to the list-based CRUD managers — no table, no search, one Save action. It reads/writes the backend's
`classifiedparam` table (one row per school year — see the backend `CLAUDE.md`'s "Classified / Not Classified
(NC) parameter" section for the table/endpoints) via `ClassifiedParamReader.fetchClassifiedParamOfYear`/
`saveClassifiedParamOfYear`. Two radio options map directly onto the backend's `classified` column (note the
inverted naming — this is the backend's own convention, not a frontend quirk): "Classification based on number
of subjects" (`classified=1`) reveals a `range` slider (`nb_matieres_rate`, integer 1-100, default 40) below it
when selected; "Classify all students" (`classified=0`) has no slider. A missing/never-saved row is treated the
same as `classified=0` (defaults to "Classify all students" selected, slider defaulted to 40 but hidden) —
matching the backend doc's own "missing row = classify everyone" convention.

**The classification algorithm itself (student → classified or NC per term) is not implemented anywhere yet** —
report-card generation, the only consumer, isn't built. It's documented here now (ported directly from the
product's existing mobile-app algorithm) so whoever builds report cards later reuses it instead of re-deriving
it, following this app's established convention of computing this kind of thing client-side from already-fetched
marks (`MarkEntryManager`'s fill-rate panel, `EffectifsManager`'s report) rather than adding a new backend
aggregation endpoint:

- Fetch `ClassifiedParamReader.fetchClassifiedParamOfYear` once per report-card run. If it's `null`, or its
  `classified` is `0`, every student is classified — skip the rest of this algorithm entirely for every
  student/term. Only when `classified === 1` does the per-student, per-term check below run.
- **Non-APC classes**: `nbMatieres = subjectsOfSelectedClasse.length * 2` (each subject counts twice — once
  per sequence of the term, same `getSequence1(term)`/`getSequence2(term)` → `1,2` / `3,4` / `5,6` mapping
  already implemented as `computeDbSequence` in `MarkEntryManager.tsx`: `(term - 1) * 2 + sequence`).
  Participation count = number of that student's `student_subject` rows (via `MarkReader.fetchSeqMarks`, the
  same reader Mark entry already uses) across both of the term's `dbsequence`s where `isEmpty === 0` — a row
  existing with `isEmpty === 1` does not count as a participation, same "isEmpty is the truth" precedent Mark
  entry and `deleteCompetencesWithNoMarks` already rely on. `rate = (participations / nbMatieres) * 100`;
  classified for that term iff `rate >= nb_matieres_rate`.
- **APC classes**: `nbMatieres = subjectsOfSelectedClasse.length` (not doubled — competences, not sequences,
  are the per-subject unit). Participation count = number of that student's `stud_comp_mark` rows (via
  `MarkReader.fetchCompMarks`, scoped to the term) with `isEmpty === 0`, summed across every competence of
  every subject of the classe for that term. Same `rate`/threshold comparison as non-APC.
- **Edge cases, both branches**: `nbMatieres === 0` (the classe/level has no subjects yet) → **not classified**
  (NC), the one case where a zero denominator doesn't fail open. Any unexpected error while computing (a
  missing param, a malformed row, etc.) should fail open to **classified** — never let a computation error
  silently NC a student. This mirrors the original mobile-app algorithm's own try/catch-defaults-to-true
  behavior; preserve it rather than tightening it when this gets implemented, since a false NC on a report
  card is a more visible, more disruptive mistake than a false classified.
- Whether a classe/level is APC or non-APC is the same `ClasseReader.fetchApcLevels` + `isLevelApc(level)`
  check already used throughout the app (see "Subjects hub and the APC / competence-based classe concept"
  above) — don't add a second way to answer that question.

### Routing and state

`src/App.tsx` (React Router v7, `BrowserRouter`) defines `/` → `LoginForm`, `/dashboard` → `Dashboard`, and
the six `/admin/*` screens above, all nested under the `RequireAuth` guard route (mounts `TopBanner` + a
`pt-16` content offset — see the Top banner section above) with the admin routes further nested under
`RequireRole allow={["ADMIN"]}` (see Role-gated admin routing above). `Footer` renders only when the
`schoolName` cookie is present. `src/components/dashboard/Dashboard.tsx` renders
`useAuth().authPayload?.name`, `{schoolYear} — {section}`, `<AdminMenuGrid />` (only when `authPayload?.role
=== "ADMIN"`), and a logout button (`useAuth().logout()` then `navigate("/")`). Role-specific dashboard
variants for non-ADMIN roles are still deferred.
No global state library is used — `react-cookie` (`CookiesProvider` in `main.tsx`) plus plain
`useState`/`sessionStorage`/`localStorage`/the one `AuthContext` is the existing pattern; keep using it
rather than introducing Redux/Zustand unless the user asks.

### Data fetching

`src/dbmanger/MyReader.tsx` is a static class wrapping native `fetch` (no axios in this project), backing
only the pre-login/unauthenticated calls: `fetchSchools()`, `fetchSchoolYears(connection)`,
`login()`/`refreshToken()`/`logout()`. Its read methods follow the same shape: build the URL off
`MyConstants.getBaseUrl()`, check `response.ok`, check `data.Response === "False"` for an API-level error,
`alert()` and return `[]` on any failure, log to console. `login()`/`refreshToken()`/`logout()` are an
intentional exception — the first two return `null`/`false` on failure instead of `alert()` + `[]`, since
`LoginForm` needs to distinguish "bad credentials" from "network error" for inline UI feedback rather than a
blind alert; `logout()` swallows errors entirely and returns `void`, since it's a best-effort fire-and-forget
call.

Every other backend-touching module has its **own** `*Reader` static class instead of growing `MyReader`
further: `FiliereReader`, `SpecialityReader`, `ClasseReader`, `SubjectReader`, `StaffReader`, `SectionReader`
(defined, not yet wired into any UI), `SchoolInfoReader`. See "Admin CRUD screens" above for their shared
`postJson`-helper shape, and "School basic info" above for `SchoolInfoReader`'s two exceptions to that shape
(multipart `FormData` for the logo upload, `Image()`-probe for `fetchLogo`). When a new feature needs backend
data, add a new `*Reader` class following this per-feature-file convention rather than centralizing everything
back into `MyReader`.

## Current state vs MVP scope

### Phase 1 — auth/session MVP (`IMPLEMENTATION_PLAN.md`, Phases 1-5) — complete

| Feature | Status |
|---|---|
| Choose a school, school year, and language before logging in | Done — `LoginForm` selects, populated from `fetchSchools()`/`fetchSchoolYears()`, persisted to `sessionStorage`/`localStorage` |
| Choose remote vs local backend server | Done — `MyConstants.getBaseUrl()`/`setBackendTarget()`, toggle in `LoginForm`; Local also special-cases the school picker (see Architecture) |
| Real login against backend (`connection`/`login`/`pwd`/`year`/`section` → JWT) | Done — `LoginForm.connectUser()` calls `useAuth().login()` → `MyReader.login()` → `POST api/accounts/connect` |
| Store access token + refresh token, attach to protected requests | Done — access token lives in-memory in `AuthContext`, silently restored via `MyReader.refreshToken()` on app load; every `*Reader` class attaches `Authorization: Bearer` per-request (see Data fetching) |
| Navigate to and gate app functionality behind auth | Done — `RequireAuth` (all authenticated routes) + `RequireRole` (ADMIN-only `/admin/*` routes) |
| Dashboard showing the connected user's name | Done — `Dashboard.tsx`; role-specific dashboard variants for non-ADMIN roles are still deferred |

### Phase 2 — ADMIN functional modules (in progress)

Reachable from the dashboard's menu grid (`AdminMenuGrid` — a card is clickable only once its `to` route is
set):

| Module | Status |
|---|---|
| School basic info ("Information de base") | Done — `/admin/school-info`, `SchoolInfoManager` (see Architecture) |
| Filières | Done — `/admin/filieres`, `FiliereManager` |
| Spécialités | Done — `/admin/specialities`, `SpecialityManager` |
| Classes | Done — `/admin/classes`, `ClasseManager` |
| Subjects (Matières) — 4 sub-modules under `/admin/subjects` (`SubjectsHub`) | Done — `matieres` (`SubjectManager`), `groupes` (`GroupeManager`), `matieresClasses` (`SubjectClasseManager`), `matieresCompetences` (`SubjectCompetenceManager`) |
| Staff (Gestion du personnel) — basic CRUD + linked account | Done — `/admin/staffs`, `StaffManager`; roles/schedules/leave from the product's feature overview are not built |
| Course assignment | Done — `/admin/course-assignment`, `CourseAssignmentManager` |
| Students (Gestion des élèves) — basic CRUD + import, no parent/phone linkage | Done — `/admin/students`, `StudentManager` (see Architecture) |
| Summary ("Bilan") — read-only "Effectifs par classe" report | Done — `/admin/effectifs`, `EffectifsManager` (see Architecture) |
| Mark entry ("Saisie des notes") — dual APC/non-APC mode, per-subject fill rate | Done — `/admin/mark-entry`, `MarkEntryManager` (see Architecture) |
| Discipline | Done — `/admin/discipline`, `DisciplineManager` |
| Fill rate (dedicated module) | Done — `/admin/fill-rate`, `FillRateHub` (`FillRateGlobalManager`/`FillRateClassManager`) |
| Account management (Gestion des comptes) — all-users credential CRUD + self-service "manage my credentials" | Done — `/admin/manage-accounts`, `AccountHub` (`AccountManager`, `SelfCredentialsManager` — the latter also reachable by any authenticated role from `Dashboard`, not just ADMIN) |
| Settings — "Classified / Not Classified (NC) parameter" | Done — `/admin/settings`, `SettingsHub` (`ClassifiedParamManager`); further settings sub-modules not started |
| Mark sheets, report cards, SMS, school reports (livrets), parents, promotions, basculement, scholarships, insolvents | Not started — inert `AdminMenuGrid` cards (no `to`) |

Cross-cutting infra built alongside the modules above, used by all of them: the top banner (global
year/section/language switch, replacing per-page back buttons), toast notifications, promise-based confirm
dialogs, the loading overlay, CSV/PDF export, and the connectivity monitor — see their respective sections
above.

When extending the app (new admin screens, role-specific dashboards, wiring `SectionReader` into the section
pickers, etc.), prefer extending the existing per-feature files (`*Reader` classes, `*Manager` components,
`src/i18n/translations.ts` dictionaries) over introducing new architectural layers — this app is small and the
existing patterns (react-cookie + plain state + static utility classes + the Auth/Toast/Confirm contexts) are
intentional for now.
