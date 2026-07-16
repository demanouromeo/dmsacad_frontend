# MVP Implementation Plan — dms_acad_react

## Context

`dms_acad_react` is the frontend for DMS ACAD. Per the repo's `CLAUDE.md`, the app currently has school
selection and a language toggle working, but no real backend/local switch, no real authentication, no token
storage, and only a placeholder dashboard. The working tree already shows the start of this transition: the
old client-side account-matching login was ripped out of `LoginForm.tsx`, `MyReader.fetchAccounts()` /
`fetchJsonFromAPI()` were deleted, and `LoginForm.handleSubmit` now calls an empty `connectUser()` stub.

This plan wires the frontend up to the backend's real contract (confirmed by reading
`app/Http/Controllers/AccountController.php` and `routes/api.php` in the backend repo) to deliver the agreed
MVP: pick a school, pick a language, pick remote vs. local backend, log in for real against the backend
(receiving an access token + an httpOnly refresh-token cookie), gate the app behind that session, and show a
v1 dashboard with the connected user's name.

**Confirmed backend contract** (do not deviate without re-checking the backend):
- `GET {baseUrl}api/accounts/connect?login=...&pwd=...&connection=...` — login. Yes, GET, with the password
  as a query param; that's the backend's existing design, not something to fix from this repo.
  Returns `{ status, message, access_token, token_type: "Bearer", expires_in, user }` on success (200) or
  `{status:false, message}` on failure (401/422). Also sets an **httpOnly**, `SameSite=Strict` `refresh_token`
  cookie — the browser handles sending it back automatically; JS never reads it directly.
- `POST {baseUrl}api/accounts/refresh` body `{connection}` — mints a new `access_token` from the
  `refresh_token` cookie. Must be called with `credentials: "include"`.
- `GET {baseUrl}api/configs/allSchools` returns a flat array of connection-key strings (e.g.
  `"CES_DE_LDIRI"`) — confirmed in `SchoolInfoController::allSchools()`. There is **no** separate
  display-name-vs-connection-code split: `selectedSchool` in `LoginForm` already *is* the `connection` value
  to send everywhere. (This resolves a caveat in the current `CLAUDE.md` — that doc should be corrected as
  part of this work.)
- The connected user's display name is inside the JWT access-token payload (`name`, plus `role`, `user_id`,
  `email`, `exp`) — not in the top-level `user` object. Decode it client-side (base64url-decode the JWT's
  middle segment; no secret available or needed).

**Decisions locked in with the user:**
- Access token lives in memory only (React context state), never in `localStorage`/`sessionStorage`. On app
  load, silently call the refresh endpoint (using the already-persisted `connection` in `sessionStorage`) to
  restore the session from the httpOnly cookie.
- Backend/CORS changes are **out of scope** for this plan — flagged below as a dependency to verify, not a
  task to implement here.

**Known dependency (not implemented here):** for local dev, the Vite dev server and Apache/XAMPP run on
different ports, so the login/refresh calls are cross-origin. The httpOnly `refresh_token` cookie will only
round-trip if the backend's CORS config allows credentialed requests from that origin (`supports_credentials
: true` + an explicit allowed origin, not `*`). Verify this against the backend before testing Phase 3
end-to-end; if it's not configured, that's a backend-repo fix, not something to patch here.

---

## Addendum — School year selection (added after Phase 1)

Before submitting credentials, the user also picks a school year for the selected `connection`, fetched from
`GET {baseUrl}api/configs/getSchoolYears?connection=...` (confirmed in
`SchoolInfoController::getSchoolYears`, returns `[{sy_id, year, is_current}]`). The `year` string (not
`sy_id`) is what almost every other backend CRUD endpoint expects as a `year` request param (confirmed by
grepping `ClasseController` and others), so that's the value persisted and reused, not the numeric id.

Implemented:
- `src/interfaces/SchoolYear.tsx` — `{ sy_id, year, is_current }`.
- `MyConstants.SCHOOL_YEAR_KEY` — new `sessionStorage` key, alongside the existing `SCHOOL_NAME_KEY`.
- `MyReader.fetchSchoolYears(connection)` — follows the same shape as `fetchSchools()`.
- `LoginForm.tsx` — a school-year `<select>` under the school `<select>`, populated whenever the school
  changes (or restored on mount), disabled until a school is chosen; selection is persisted to
  `sessionStorage[SCHOOL_YEAR_KEY]` on submit and required (alongside the school) before `connectUser()`
  runs. Switching the remote/local backend target resets both school and school-year selection, since a
  `connection` value from one backend isn't guaranteed to exist on the other.

This means Phase 3's `AuthContext` (and any future CRUD calls) should read `sessionStorage[SCHOOL_YEAR_KEY]`
as the `year` to send alongside `connection` — treat it as part of "the connected user's session," not just a
login-form-local concern.

---

## Phase 1 — Backend target switch (remote vs. local)

1. **`src/dbmanger/MyConstants.tsx`**: add a `BACKEND_TARGET_KEY` storage key and a `getBaseUrl()` /
   `setBackendTarget()` pair that reads/writes the choice to `localStorage` (default: remote), returning
   either `gBaseRemoteUrl` or `gBaseLocalUrl`.
2. **`src/dbmanger/MyReader.tsx`**: replace the hardcoded `MyConstants.gBaseRemoteUrl` in `fetchSchools()`
   with `MyConstants.getBaseUrl()`, so every request point routes through the one switch.
3. **`src/components/logincomps/LoginForm.tsx`**: add a small remote/local toggle near the existing
   language-flag buttons (same visual pattern as `FlagFR`/`FlagGB`), calling `MyConstants.setBackendTarget()`
   and re-triggering `loadSchools()` so the school list reflects the newly selected backend.

## Phase 2 — Auth primitives (no UI yet)

1. **`src/interfaces/AuthPayload.tsx`** (new): TS interface for the decoded JWT payload —
   `{ sub, email, role, name, user_id, iat, exp }` — matching `AccountController::login`'s
   `$accessTokenPayload`.
2. **`src/dbmanger/jwt.ts`** (new): `decodeJwtPayload(token: string): AuthPayload | null` — base64url-decode
   the token's middle segment and `JSON.parse` it, wrapped in try/catch returning `null` on malformed input.
   No signature verification (no secret available client-side; this is purely for display).
3. **`src/dbmanger/MyReader.tsx`**: add two methods, following the file's existing shape (check
   `response.ok`, handle failure, log to console) but returning `null`/`false` on failure instead of `alert()`
   + `[]`, since callers need to distinguish "bad credentials" from "network error" for inline UI feedback:
   - `login({ login, pwd, connection })` → `GET api/accounts/connect` with query params
     (`encodeURIComponent` each value), `credentials: "include"`. Returns the parsed success body or `null`.
   - `refreshToken(connection)` → `POST api/accounts/refresh`, `credentials: "include"`, JSON body
     `{ connection }`. Returns the new `access_token` string or `null`.

## Phase 3 — Auth state (React context)

1. **`src/auth/AuthContext.tsx`** (new): a context/provider holding `{ accessToken, authPayload, connection,
   isRestoring, login(), logout() }`.
   - `login(loginVal, pwd, connection)`: calls `MyReader.login`, on success stores `access_token` in state,
     decodes it via `decodeJwtPayload` into `authPayload`, stores `connection`, persists `connection` to
     `sessionStorage[MyConstants.SCHOOL_NAME_KEY]` (already done in `LoginForm`, keep it consistent). Returns
     a boolean/result so `LoginForm` can show its existing alert-based error message on failure.
   - `logout()`: clears in-memory state. (No backend logout endpoint exists — confirmed by reading
     `routes/api.php` — so this is client-side only for now.)
   - On mount: if `sessionStorage[SCHOOL_NAME_KEY]` has a value, attempt `MyReader.refreshToken(connection)`
     to silently restore the session from the httpOnly cookie; set `isRestoring` false when done (success or
     failure) so route guards know when it's safe to redirect.
2. **`src/main.tsx`**: wrap `<App />` in `<AuthProvider>`, inside the existing `<CookiesProvider>`.

## Phase 4 — Wire up LoginForm

1. **`src/components/logincomps/LoginForm.tsx`**: implement the existing `connectUser()` stub using
   `useAuth().login(loginVal, passwordVal, selectedSchool)`. On success, `navigate("/dashboard")` (see Phase
   5 for the route rename). On failure, reuse the existing `t.alertBadCredentials(selectedSchool)` alert —
   consistent with the file's current error-handling style; a nicer inline error box is flagged in the code
   already (`//DISPLAY A BEAUTIFUL BOX RATHER THAN AN ALERT`) but is explicitly out of MVP scope.
2. Remove the now-dead `accountList`/`setAccountList` state and the unused `Account` import, left over from
   the deleted client-side-matching flow.

## Phase 5 — Route guard + Dashboard v1

1. **`src/components/routing/RequireAuth.tsx`** (new): reads `useAuth()`; while `isRestoring` is true render
   nothing/a loading state (reuse `src/components/sharedcomp/Loading.tsx`); once resolved, render its
   children if `accessToken` is set, otherwise `<Navigate to="/" replace />`.
2. **`src/App.tsx`**: change the `/dashboard-teacher` route to `/dashboard`, wrapped with `RequireAuth`.
3. **Rename `src/components/dashboard/TeacherIndex.tsx` → `src/components/dashboard/Dashboard.tsx`**: drop
   the `sessionStorage`-based `AccessGranted`/`AccessDenied` placeholder logic (superseded by `RequireAuth`),
   render the connected user's name from `useAuth().authPayload?.name`, and add a logout button that calls
   `useAuth().logout()` then navigates to `/`. Role-specific dashboard variants (teacher vs. admin vs. other
   roles from `authPayload.role`) are explicitly deferred past v1 per the user's stated MVP scope.

## Phase 6 — Cleanup & docs

1. Re-read the final diff for leftover dead code/comments (e.g. now-unused `isLoading`/`Loading` wiring if
   any, stray `console.log`s introduced during this work).
2. Update `dms_acad_react/CLAUDE.md`: flip the MVP-scope table rows to "Done" as each is completed, correct
   the school-selection caveat now that `allSchools` is confirmed to return connection codes directly (not a
   separate display name), and document the new `AuthContext`/`RequireAuth` pieces the same way the doc
   already documents `MyReader`/routing conventions.

---

## Verification

- `npm run dev`, exercise the happy path against the local backend (XAMPP must be running the backend on
  `http://localhost/dmsacad_backend_dev/`): pick a school, pick language, pick "local" backend target, log in
  with a real account, confirm redirect to `/dashboard` and the correct name rendered.
- Bad password / bad login: confirm the existing alert fires and no navigation happens.
- Reload the page while on `/dashboard`: confirm the silent refresh restores the session (no bounce to `/`)
  when the refresh cookie is valid, and confirm it does bounce to `/` when `sessionStorage` has no school
  selected (fresh browser/session).
- Logout: confirm it clears state and returns to `/`, and that navigating directly to `/dashboard` afterward
  redirects to `/`.
- `npm run build` and `npm run lint` clean.
- If the local cross-origin refresh cookie doesn't round-trip, treat it as the flagged CORS dependency (check
  the backend's CORS config) rather than a frontend bug.
