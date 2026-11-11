# Frontend routing and menu navigation fix report

Date: 09/11/2026, Asia/Saigon. The work extends the authorized Class Setup implementation; it does not implement other team members' missing modules. Browser interaction is **not verified**: two Computer Use inventory calls reported `The browser access host is unavailable` and an unavailable native pipe. Results below distinguish real HTTP observations, source evidence, automated React/DOM tests, and blocked manual-browser verification.

## 1. Actual frontend and backend

- Frontend: port 5173, running from **`training-management/frontend`**. Its `.env` sets `VITE_API_URL=http://localhost:8080/api`. Vite returns HTTP 200 for the new `ClassSetupPage.tsx` module; that file does not exist in the sibling root `frontend` tree.
- Backend: port 8080 serves **`training-management/backend`**, not sibling root `backend`. The application startup log names the nested backend working directory and `training-management/backend/target/classes`. The Java process remains PID 27016; DevTools can reload its application context without changing that PID.
- Do not assume the two backend directories are synchronized. Only the nested backend was changed for Class Setup.
- Earlier OpenAPI evidence had no Setup routes. Later live evidence returns **200 for both `/api/classes/4/setup` and `/api/classes/6/setup`**, and OpenAPI lists all four added Setup endpoint paths. The running backend therefore now contains Setup read APIs; a blanket claim that it is still the old backend would be incorrect.
- No restart command was issued. Existing logs record DevTools background reloads around 14:06. H2 remains `jdbc:h2:mem:base_crud`, `ddl-auto=create-drop`; further restarts are unsafe without a persistence plan. No reset, SQL update, role grant, or class 4/6 write was performed.

Evidence: workspace `.run/routing-live-menus.json`, `.run/class-setup-live-evidence.json`, `.run/training-backend.log`. Captured files contain read responses; they are not database restore scripts.

## 2. Verified causes and fixes

### Static routes were rejected by the dynamic menu resolver

`AppRoutes` built its lookup from only `isModuleDriven` routes. Backend menu rows point to `/programs`, `/subjects`, and `/class-setup`, but those implemented pages are explicit/static registrations. Dynamic routes were rendered first and sent a known, implemented URL to `/not-found-page`; the static registration did not rescue it. Before this task, Class Setup additionally had no implemented page/API at all; the preceding implementation adds that actual feature.

The resolver now looks up both generated and explicit registrations, preferring explicit implementations. It does not add a placeholder page for an unknown module. Static duplicates are omitted only when a corresponding dynamic menu route is present. Unknown, unimplemented URLs retain the not-found behavior. The dynamic route retains menu permission checks and also enforces the registered component's declared permission.

### Menu permissions differed from the existing API resource

Live menu metadata for Modules and Module Groups declares `USER_READ`; their existing services enforce resource `MENU`, action READ. `resolveMenuPermission` normalizes only `/menus` and `/menu-groups` to `MENU_READ` in menu filtering and route guards. Generated registrations for those pages use the same permission. No account, role or database menu record was changed. The agent did not grant permissions.

Live limited-account checks confirm the account already has MENU_READ, PROGRAM_READ and SUBJECT_READ: Modules/Module Groups, Programs and Topics APIs return 200, while Class Setup APIs return 403 because the account lacks the required class/assignment privileges. A USER_READ-only frontend fixture is denied the system menu pages and sends no forbidden API request.

### Session navigation and class identity

The existing `/sessions` page was generated as module-driven, but the live backend has no Sessions menu row (the sidebar intentionally hides it). Calendar's Manage Sessions link therefore had no active route despite an existing implementation. The registry now explicitly reuses `SessionManagementPage` at `/sessions`, guarded by SESSION_READ, without adding a sidebar item or altering the session workflow.

The regression test exposed a separate identity mismatch: Session class labels, relation filters and class selectors used Shared Class API. Internal ID 4 is a DOTNET class while Shared ID 4 denotes a different class. Those three lookups now use existing internal `clsApi`/`useClasses`, with a paginated `getAllClasses` client helper. Trainer/room sourcing, session mutation rules and all backend session endpoints remain unchanged.

## 3. Menu-by-menu results

WORKING below means the implemented component/route and relevant read API were verified by source, automated tests or HTTP as specified; it is **not** a claim of browser verification or validation of mock business data.

- **Training Programs** — backend menu `/programs`, PROGRAM_READ; frontend navigates `/programs`; component `ContentPage` → `ProgramList`. **ROUTE_BROKEN → WORKING** after resolver fix. Live `GET /api/programs` = 200. Direct entry, remount/refresh simulation and real Sidebar-link integration tested.
- **Kế hoạch môn học lớp** — backend menu `/class-setup`, CLASS_READ; frontend `/class-setup` or `/class-setup?classId=4`; component `ClassSetupPage`/`ClassSetupForm`. **NOT_IMPLEMENTED → WORKING** for the authorized Setup feature, and dynamic route conflict fixed. Form read access additionally requires PROGRAM_READ and ASSIGNMENT_READ. Live Setup GETs for internal 4 and 6 = 200; limited account = **RBAC_BLOCKED (403)**. Trainer writes remain BLOCKED by sample Master API, not by routing.
- **Class → Class List** — backend menu `/classes`, SESSION_READ; component `ClassListPage`. **WORKING**, not previously one of the static-lookup failures. Class data access also requires CLASS_READ. Details `/classes/4?tab=info` use `ClassDetailPage`; direct-entry/remount integration tests preserve exactly five FAMS tabs.
- **Audit** — no corresponding backend Module row in the inspected menu; Sidebar's existing Training Operations grouping supplies `/training/audit`. Component `AuditPage`. **WORKING navigation**, automated route test passed; live `/api/external/audits` = 200. It uses the configured sample master source, so real audit data is not claimed verified. No dedicated audit permission or module implementation was added.
- **Trainee** — no backend row; existing Sidebar path `/training/trainee`; component `TraineePage`. **NOT_IMPLEMENTED**: the component only renders an empty layout. No fake implementation was added. This is separate from the working Class Trainee List/Import Trainees feature.
- **Log Work** — no backend row; existing Sidebar path `/training/log-work`; component `LogWorkPage`. **NOT_IMPLEMENTED**, empty layout retained.
- **Content** — no backend row; existing Sidebar path `/training/content`; component `ContentPage` with Program/Topic views. **WORKING navigation**, automated route test passed. Related catalog APIs require PROGRAM_READ/SUBJECT_READ; the existing outer static route requires authentication. No content-module rewrite was made.
- **Reports** — no backend row; existing Sidebar path `/training/reports`; component `ReportsPage`. **NOT_IMPLEMENTED**, empty layout retained. No report module was fabricated.
- **Subjects** — backend menu `/subjects`, SUBJECT_READ; frontend `/subjects`; component `ContentPage` → `TopicList`, backed by the existing Subject/Topic API. **ROUTE_BROKEN → WORKING**. Live `/api/topics` = 200. Restricted route test returns 403, not 404.
- **Modules** — backend menu `/menus`, legacy USER_READ; frontend `/menus`; existing `AutoCrudPage` with module entity config. **WORKING route**, permission normalized to MENU_READ to match `/api/modules`. Live API = 200. No duplicate module-management component/endpoint was created.
- **Module Groups** — backend menu `/menu-groups`, legacy USER_READ; frontend `/menu-groups`; existing `AutoCrudPage` with module-group config. **WORKING route**, permission normalized to MENU_READ to match `/api/module-groups`. Live API = 200.
- **Session Management** — no backend sidebar row; `/sessions?classId=4` explicitly reuses the existing page. **ROUTE_BROKEN (missing active route) → WORKING** after registry fix. Regression verifies the internal class label and absence of `/external/classes` requests.

No business implementation was added for Trainee, Log Work or Reports. Their owning team must implement those modules; no message was sent to another person on the user's behalf.

## 4. Error handling and RBAC

- Missing frontend permissions → existing `/unauthorized` page with 403; guards remain enabled.
- Backend Setup 403/404/500 → `ApiErrorState` on the same valid `/class-setup?classId=4` route, showing the actual HTTP status. It does not become `/not-found-page`.
- Menu transport HTTP 500 → API error panel, not a fake missing-page redirect.
- A truly unknown route or a backend menu path with no registered implementation remains not-found; no catch-all placeholder was introduced.
- The Class Setup modal opens for the same resolved internal ID from each supported Class Details alias. Class Info, Trainee List, Calendar, Budget & Operation Info and Activities remain exactly five tabs.

## 5. Changed files

Routing/menu:

- `frontend/src/App.tsx` — complete registry lookup, explicit-route preference, duplicate-path handling and retained permission checks.
- `frontend/src/router/component-registry.ts` — actual Class Setup page and existing Session Management list registration.
- `frontend/src/router/menu-permission.utils.ts` — new narrow MENU_READ compatibility mapping.
- `frontend/src/router/build-router.ts` and `frontend/src/hooks/useSidebarMenus.ts` — apply that mapping consistently.
- `frontend/src/router/AppMenuRouting.test.tsx` — new real App/Sidebar/router/RBAC/API-error regressions.

Internal session identity:

- `frontend/src/api/features/cls.api.ts` — paginated internal-class client helper; no new backend endpoint.
- `frontend/src/components/session/ClassLabel.tsx`, `SessionDialogs.tsx`, and `frontend/src/pages/management/demo/session/session.schema.ts` — replace shared-class lookups only.

Setup and regressions:

- The backend/frontend Setup files, API contracts and business checks are listed in [CLASS_SETUP_IMPLEMENTATION.md](CLASS_SETUP_IMPLEMENTATION.md).
- `ClassReadinessPanel.test.tsx` and `ClassReadinessNavigation.test.tsx` now test the actual Setup action rather than an unavailable-feature notice.
- `ClassSetupForm.test.tsx` tests linking, MAIN create/update, reload, mismatch, date range, permissions, failures and no sample fallback.
- `ClassModal.test.tsx` uses direct change events for its payload test instead of many individual key events; this removes a worker-contention timeout without weakening its save/trim/internal-endpoint assertions.
- `docs/class-readiness-investigation.md` is marked historical; its initial snapshot is preserved.

Dashboard KPI, Import Trainees, backend Session Management, and Phase 1 security code were not rewritten. A concurrent auth-token source edit was preserved, copied only into isolated validation, and included in the final backend test run.

## 6. Executed validation

- **PASS:** full backend suite, **209 tests**, zero failures/errors. Command: `mvn -B -ntp test`, run in `.run/class-setup-validation/backend`; production H2 was not used for fixtures.
- **PASS:** TypeScript: local `tsc -b --pretty false`.
- **PASS:** production build: `npm run build`. The existing large-bundle warning remains non-fatal.
- **PASS:** full frontend suite, **233 tests across 19 files**, command `npm test -- --maxWorkers=2`. This includes 23 App/menu routing regressions, the Setup form/permission tests, and the existing class/import/calendar/session tests. Log: `.run/class-setup-validation/frontend-tests-complete.log`.
- **PASS:** live read-only HTTP checks: Program/Topic/System Menu/Audit APIs = 200 for ADMIN; limited Setup requests = 403; Setup APIs and OpenAPI paths are present in the currently running backend.
- **PASS (HTTP shell only):** Vite direct URLs `/class-setup`, `/class-setup?classId=4`, `/classes/4?tab=info`, `/programs`, `/subjects`, `/menus`, `/menu-groups` serve HTTP 200 SPA HTML. This is not a substitute for React navigation tests or a real browser refresh test.
- **BLOCKED / NOT BROWSER-VERIFIED:** computer/browser host unavailable on two attempts. No screenshot, click-through or manual refresh result is claimed.

Logs: workspace `.run/class-setup-validation/backend-tests-current.log` and frontend validation logs in that directory. Initial intermediate runs identified a JWT test fixture with a missing last name, a typing-heavy test timeout, and the real shared-class lookup defect in Session navigation. The fixture and test simulation were corrected; the product identity defect was fixed and retained in regression coverage. These earlier failures were not reported as passing results.

## 7. Browser verification steps

1. Sign in to `http://localhost:5173` as an existing authorized administrator. Do not change roles or permissions.
2. Open Training Programs and Subjects from Sidebar; confirm correct catalog views and no `/not-found-page` redirect.
3. Open Kế hoạch môn học lớp; select an internal class. Directly load `/class-setup?classId=4` and refresh. Confirm header internal ID 4 and the actual saved class code.
4. Open `/classes/4?tab=info`; verify the five FAMS tabs. Use Open Class Setup and confirm the same internal ID in the modal. Do not save changes to classes 4 or 6 during read-only verification.
5. Verify Modules/Module Groups with a user already holding MENU_READ, then a user lacking it. Missing permission must show 403/access denied, not 404.
6. In Calendar, follow Manage Sessions; confirm `/sessions?classId=<internal ID>` and the same internal class label.
7. Test backend API errors only in an isolated test environment; Setup HTTP 500 must stay on the Setup route with Server error/HTTP 500.

## 8. Remaining blockers and runtime state

The real Master Trainer/Room source is not configured: the current data-source API reports `sampleData=true`. No real teaching assignment or READY status was fabricated. Program mismatches require explicit user curriculum review. Trainee/Log Work/Reports remain NOT_IMPLEMENTED. Browser verification remains blocked by the unavailable host.

Backend Setup code is currently visible through live GET/OpenAPI after observed automatic DevTools reloads. No agent-initiated restart, H2 reset, class-data change, Git add/commit/push/pull/merge/reset, or production permission change was performed. Because live class data changed between snapshots, the report does not claim those records remained identical throughout the whole session; the agent did not overwrite them or restore earlier data.
