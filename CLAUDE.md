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
  endpoint returns (the backend only rotates the password when a non-empty value is supplied).

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

### Export to CSV/PDF (`src/utils/exportData.ts`, `src/components/sharedcomp/ExportButtons.tsx`)

All five admin CRUD screens above render `<ExportButtons onExportExcel={...} onExportPdf={...} .../>` above
their table, disabled while loading or empty. `exportRowsToCsv(filename, columns, rows)` builds a plain
UTF-8-BOM `.csv` client-side (not a real `.xlsx`) — deliberate: the npm `xlsx`/SheetJS package carries open,
unpatched high-severity advisories, and this data has no formatting/multi-sheet need that would justify it;
Excel opens `.csv` natively and the BOM keeps accented characters intact. `exportRowsToPdf(title, filename,
columns, rows)` dynamically `import()`s `jspdf`/`jspdf-autotable` (keeps them out of the main bundle) and
renders a simple titled table. Both take an `ExportColumn<T>[]` (`{header, accessor: (row: T) => string |
number}`) — reuse this exact shape for a new screen's export rather than writing a bespoke CSV/PDF builder.
`buildExportFilename(parts, extension)` joins/sanitizes filename parts (title, connection, year, section) —
follow the same `[title, connection, schoolYear, section]` convention other screens use so exported filenames
stay predictable.

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
| Course assignment, students, marks entry, mark sheets, report cards, fill rate, discipline, summary, SMS, school reports (livrets), parents, account management, settings, promotions, basculement, scholarships, insolvents | Not started — inert `AdminMenuGrid` cards (no `to`) |

Cross-cutting infra built alongside the modules above, used by all of them: the top banner (global
year/section/language switch, replacing per-page back buttons), toast notifications, promise-based confirm
dialogs, the loading overlay, CSV/PDF export, and the connectivity monitor — see their respective sections
above.

When extending the app (new admin screens, role-specific dashboards, wiring `SectionReader` into the section
pickers, etc.), prefer extending the existing per-feature files (`*Reader` classes, `*Manager` components,
`src/i18n/translations.ts` dictionaries) over introducing new architectural layers — this app is small and the
existing patterns (react-cookie + plain state + static utility classes + the Auth/Toast/Confirm contexts) are
intentional for now.
