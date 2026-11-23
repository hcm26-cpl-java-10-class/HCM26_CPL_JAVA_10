### 5.1. Workspace Analytics

#### 5.1.1. US-ANL-001 – Analytics Workspace Navigation, Shell & RBAC Access Control ([Author Name])

#### 5.1.1.1. Objective

Provide authenticated and authorized users with dedicated, read-only entry points to the Project Analytics workspace, render the standardized Analytics workspace shell (header, layout, loading skeletons, and error/empty resilience states), and strictly enforce deny-by-default Role-Based Access Control (RBAC) and tenant/project scope isolation across both frontend and backend layers.

#### 5.1.1.2. Actors

- **Primary Actors:**
  - **Student (Team Member / Team Leader):** Opens read-only analytics for projects in which they hold an active team membership.
  - **Mentor / Teacher:** Opens read-only analytics for projects assigned to them via the sidebar project selector or the project workspace.
  - **Program Manager (PM) / Class Admin:** Opens read-only analytics for projects within their managed classes/scope.
  - **Administrator (`ADMIN` / `SUPER_ADMIN` / `PO`):** Opens read-only analytics across all active projects within their tenant.
- **Supporting Actor:**
  - **System (Frontend Router, Workspace Shell & Backend Security/Analytics Service):** Evaluates authentication, role permissions (`PROJECT_ANALYTICS_READ`), tenant status, and project scope, then returns and renders the read-only analytics shell without mutating any project data.

#### 5.1.1.3. Preconditions

- The user is authenticated with a valid, active session (valid JWT token).
- The user account is active (`isActive = true`) and not locked (`locked = false`).
- The user belongs to an active tenant (`tenant.active = true` and `tenant.isActive = true`).
- The user's active role is granted the `PROJECT_ANALYTICS_READ` permission.
- At least one active project exists within the user's authorized scope (assigned team member, assigned mentor, managed class, or tenant-wide admin/PO scope).

#### 5.1.1.4. Postconditions

- **Success:**
  - The user reaches the Project Analytics selector (`/analytics/projects`), the standalone Project Analytics shell (`/projects/:projectId/analytics`), or the embedded Workspace `Analytics` tab (`/management/workspaces/:id?tab=analytic`).
  - The Analytics workspace shell renders with project header metadata (`Project Analytics`, active scope/sprint label, last-updated timestamp in the tenant time zone), action buttons (`Share` and role-gated `Export report`), filter bar, KPI strip, and trend chart containers.
  - All HTTP responses include `Cache-Control: no-store`, and frontend queries use `staleTime: 0` and `gcTime: 0` so no analytics data persists in cache after session termination.
  - Zero mutations are performed on Sprints, Backlog items, Tasks, or mutation audit logs (`readOnly = true`).
- **Failure / Access Denied:**
  - Unauthorized, unauthenticated, out-of-scope, or invalid project requests are blocked cleanly without leaking any project metadata or analytics payloads.

#### 5.1.1.5. Trigger

The user performs one of the following actions:
1. Clicks **Analytics → Project Analytics** in the main navigation sidebar (navigates to `/analytics/projects`), then selects a project card and clicks **Open analytics**.
2. Opens a project workspace (`/management/workspaces/:id`) and clicks the **Analytics** tab (`?tab=analytic`).
3. Navigates directly to `/projects/:projectId/analytics` via URL or a shared link.

#### 5.1.1.6. Main Flow

| Step | Actor | Action / System Response |
| --- | --- | --- |
| 1 | User | Clicks **Project Analytics** under the **Analytics** group in the sidebar navigation. |
| 2 | Frontend | Verifies authentication and `PROJECT_ANALYTICS_READ` via `ProtectedRoute`, then mounts `ProjectAnalyticsIndexPage` (`/analytics/projects`) and displays loading skeletons. |
| 3 | Frontend | Sends `GET /api/v1/projects/analytics/options` with the user's Bearer JWT token. |
| 4 | Backend | Validates `hasAuthority('PROJECT_ANALYTICS_READ')`, re-verifies active user, active tenant, and persisted `PROJECT_ANALYTICS_READ` permission via `ProjectAnalyticsAccess.requireUser()`, filters active tenant projects through `WorkspaceAccessService.canAccessProject()`, and returns HTTP `200 OK` with `Cache-Control: no-store` and a case-insensitively sorted list of authorized projects. |
| 5 | Frontend | Renders the authorized project cards displaying each project's code, name, status badge, and an **Open analytics** button. |
| 6 | User | Clicks **Open analytics** on a target project card. |
| 7 | Frontend | Navigates to `/projects/:projectId/analytics`, verifies `ProtectedRoute` (`PROJECT_ANALYTICS_READ`), mounts `ProjectAnalyticsPage`, validates `projectId` as a positive safe integer, and displays the `ShellLoading` skeleton layout. |
| 8 | Frontend | Sends `GET /api/v1/projects/{projectId}/analytics` with optional URL query filters and the user's Bearer JWT token. |
| 9 | Backend | Executes `@PreAuthorize("hasAuthority('PROJECT_ANALYTICS_READ')")`, runs `ProjectAnalyticsAccess.requireUser()` and `requireProject(user, rawProjectId)` (checking project existence, active status, same tenant, and project scope), executes a `@Transactional(readOnly = true)` query, and returns HTTP `200 OK` with `Cache-Control: no-store` and the `ProjectAnalyticsResponse` payload (`readOnly: true`). |
| 10 | Frontend | Renders the full Analytics workspace shell inside `MainLayout` with breadcrumbs (`Project Management → <Project Name> → Analytics`), the header (`Project Analytics`, scope/sprint label, last-updated timestamp, **Share** button, and permission-gated **Export report** dropdown), filter bar, KPI cards, trend charts, and current-window work items section. |

#### 5.1.1.7. Alternative Flows and Exceptions

**5.1.1.7.1. Accessing Analytics via the Embedded Workspace Tab**

1. While viewing a project workspace (`/management/workspaces/:id`), the user clicks the **Analytics** tab in the workspace tab bar (visible whenever the workspace is linked to a valid `projectId`, and enabled only if the user holds `PROJECT_ANALYTICS_READ`).
2. The frontend updates the URL query string to `?tab=analytic` (preserving workspace context) and renders `ProjectAnalyticsPage` inside `EmbeddedLayoutContext.Provider` with the resolved `projectId`.
3. Execution continues from Step 8 of the Main Flow, keeping the workspace header and tabs visible around the embedded Analytics shell. If the user lacks `PROJECT_ANALYTICS_READ`, the tab is disabled with tooltip *"Analytics access is not granted for your role"*, and direct URL navigation to `?tab=analytic` renders `WorkspaceSectionState` in a denied state.

**5.1.1.7.2. Unauthenticated User or Expired Session (HTTP 401)**

1. If an unauthenticated visitor accesses `/analytics/projects` or `/projects/:projectId/analytics`, `ProtectedRoute` immediately redirects to `/login`.
2. If the user's session expires mid-navigation and the backend returns `401 Unauthorized` (`AuthenticationCredentialsNotFoundException` or invalid `UserPrincipal`), `ProjectAnalyticsPage` renders the **Session expired** state card (*"Your session is no longer valid. Sign in again to view project analytics."*) with a **Sign in** button linking to `/login`.

**5.1.1.7.3. Missing Permission or Unauthorized Project / Tenant Scope (HTTP 403)**

1. If the user lacks `PROJECT_ANALYTICS_READ` on the frontend, the sidebar item is hidden and `ProtectedRoute` redirects direct route navigation to `/unauthorized`.
2. If a user holding `PROJECT_ANALYTICS_READ` requests a project belonging to another tenant, a project outside their membership/mentor/PM scope, or if their account/tenant/permission was revoked server-side, `ProjectAnalyticsAccess` throws `AccessDeniedException` and `ProjectAnalyticsErrors` returns HTTP `403 Forbidden` with no project metadata.
3. On `/projects/:projectId/analytics`, the frontend renders the **403 · Permission denied** card (*"You do not have access to analytics for this project. Ask your program manager to check your project membership."*) with a **Back to dashboard** button linking to the role's home path. On `/analytics/projects`, a `403` response displays the **Permission denied** card with a **Back to dashboard** button.

**5.1.1.7.4. Non-Existent, Inactive, or Malformed Project ID (HTTP 404)**

1. If the URL contains a non-numeric, zero, or negative `projectId`, `ProjectAnalyticsPage` immediately renders **404 · Project not found** without leaking route internals.
2. On the backend, `ProjectAnalyticsAccess.requireProject()` parses the raw path variable `projectId` manually so malformed IDs, missing projects, and inactive projects (`isActive != true`) all return HTTP `404 Not Found` (`"Project was not found"`) rather than `400 Bad Request`, preventing ID enumeration.
3. The frontend displays the **404 · Project not found** card (*"This project does not exist or has been deleted. Check the address or return to your dashboard."*) with a **Back to dashboard** button.

**5.1.1.7.5. No Authorized Projects Available (Empty Selector State)**

1. If `GET /api/v1/projects/analytics/options` returns HTTP `200 OK` with an empty list `[]`, `ProjectAnalyticsIndexPage` renders the **No projects available** card (*"You are not a member, mentor or manager of any project yet."*) with a **Back to dashboard** button.

**5.1.1.7.6. Transient Backend or Network Error (HTTP 500)**

1. If the backend encounters an unexpected error (`500 Internal Server Error`) or a network failure occurs, `ProjectAnalyticsErrors` returns `{ status: 500, message: "The analytics data could not be loaded; please try again", errors: {} }`.
2. The frontend displays an inline error alert banner (*"Unable to load analytics data right now. Please try again."*) with a **Retry** button that triggers `query.refetch()` (and on `/analytics/projects`, a **Try again** button).

#### 5.1.1.8. Business Rules and Notes

1. **Deny-by-Default Dual-Layer Authorization:** Every analytics endpoint is protected at the HTTP layer via `@PreAuthorize("hasAuthority('PROJECT_ANALYTICS_READ')")` and re-validated at the service layer by `ProjectAnalyticsAccess`, which re-reads the persisted user record, active/locked flags, active tenant status, active role grants, and project membership/scope from the database on every request.
2. **Role & Scope Matrix:**
   - `SUPER_ADMIN`, `ADMIN`, `PO`: Access to all active projects within their own tenant.
   - `PROGRAM_MANAGER`, `PM`, `CLASS_ADMIN`: Access to active projects linked to training classes they are authorized to manage within their tenant.
   - `MENTOR`, `TEACHER`: Access to active projects where they are the assigned mentor (or authorized class manager) within their tenant.
   - `STUDENT`: Access strictly limited to active projects where they hold an `ACTIVE` team membership within their tenant.
   - Cross-tenant access is always denied (`403 Forbidden`), even for administrative roles.
3. **Strict Read-Only Guarantee:** All navigation and shell endpoints use HTTP `GET` only (`@Transactional(readOnly = true)`), return `readOnly: true` in the response payload, and never alter Sprint, Backlog, Task, or mutation audit records.
4. **No Post-Session Data Caching:** Backend endpoints explicitly return `Cache-Control: no-store`. Frontend React Query hooks (`project-analytics-options` and `project-analytics-shell`) disable client-side persistence with `staleTime: 0`, `gcTime: 0`, and `retry: false`.
5. **Anti-Enumeration Error Contract:** Malformed, non-positive, missing, or soft-deleted (`isActive = false`) project IDs uniformly return `404 Not Found`. Out-of-tenant or out-of-scope projects uniformly return `403 Forbidden` without exposing project code, name, or status.
6. **Navigation Registration & Shareability:** The sidebar menu entry (`Project Analytics` under group `Analytics`, icon `bar-chart`, URL `/analytics/projects`, order `3`) is registered via `@ResourceMenu` gated by `PROJECT_ANALYTICS_READ`. Clicking **Share** in the analytics shell header copies the current browser URL (including any applied filter parameters) to the clipboard.
7. **Export Action Visibility in Shell Header:** Although the Analytics shell is read-only, the **Export report** control in the header is enabled only when `shell.canExport === true` (requiring `PROJECT_ANALYTICS_EXPORT` and an eligible Mentor, PM, Admin, or active Team Leader role) and the current scope contains data; otherwise, it is disabled with an explanatory tooltip.

### 5.1.1.9. Backend Testing Evidence on Swagger

Insert Swagger UI screenshots after executing each primary API endpoint serving this Use Case.

#### API 1 – List Authorized Projects for Analytics Selector

- **API:** `GET /api/v1/projects/analytics/options` *(also mapped at `/api/projects/analytics/options`)*
- **Request Data:**
  - **Header:** `Authorization: Bearer <valid_jwt_token>`
  - **Parameters:** None
- **Expected Result:** HTTP `200 OK` with response header `Cache-Control: no-store` and a JSON array of active projects inside the caller's authorized tenant and role scope, sorted alphabetically by `name`:
  ```json
  [
    {
      "projectId": 1,
      "code": "PRJ-ECOM-01",
      "name": "Demo E-Commerce Hub",
      "status": "ACTIVE"
    }
  ]
  ```
- **Actual Result:** `[Insert HTTP status code, e.g., 200 OK, Cache-Control: no-store header, and actual JSON response summary]`

![Swagger test result for GET /api/v1/projects/analytics/options](images/us-anl-001-swagger-options.png)

**Figure 5.1.1-1. Swagger API test result for listing authorized Project Analytics options (`GET /api/v1/projects/analytics/options`)**

---

#### API 2 – Load Read-Only Project Analytics Shell Payload

- **API:** `GET /api/v1/projects/{projectId}/analytics` *(also mapped at `/api/projects/{projectId}/analytics`)*
- **Request Data:**
  - **Header:** `Authorization: Bearer <valid_jwt_token>`
  - **Path Parameter:** `projectId = 1` *(for RBAC negative tests: unauthorized `projectId` → `403 Forbidden`; invalid/non-existent `projectId = 99999` or `abc` → `404 Not Found`)*
  - **Query Parameters:** *(Optional — omitted on initial shell load to resolve the default scope)*
- **Expected Result:** HTTP `200 OK` with response header `Cache-Control: no-store` and a read-only `ProjectAnalyticsResponse` JSON payload containing project metadata (`readOnly: true`, `canExport`), resolved filters, chart window (`timeZone`), KPIs, trend series, and widgets:
  ```json
  {
    "projectId": 1,
    "projectCode": "PRJ-ECOM-01",
    "projectName": "Demo E-Commerce Hub",
    "projectStatus": "ACTIVE",
    "readOnly": true,
    "canExport": true,
    "filters": {
      "scope": "SPRINT",
      "sprintId": 4,
      "itemType": "ALL",
      "startDate": null,
      "endDate": null,
      "sprints": [ ... ],
      "defaultSprintId": 4,
      "backlogItemCount": 12,
      "itemTypes": ["ALL", "STORY", "BUG", "TASK"]
    },
    "window": {
      "startDate": "2026-11-02",
      "endDate": "2026-11-23",
      "granularity": "DAY",
      "timeZone": "Asia/Ho_Chi_Minh"
    },
    "kpis": [ ... ],
    "creationTrend": { ... },
    "cycleTimeTrend": { ... },
    "leadTimeTrend": { ... },
    "completionTrend": { ... },
    "widgets": [ ... ]
  }
  ```
- **Actual Result:** `[Insert HTTP status code, e.g., 200 OK for authorized project / 403 Forbidden for out-of-scope project / 404 Not Found for invalid projectId, and response summary]`

![Swagger test result for GET /api/v1/projects/{projectId}/analytics](images/us-anl-001-swagger-shell.png)

**Figure 5.1.1-2. Swagger API test result for loading the Project Analytics workspace shell (`GET /api/v1/projects/{projectId}/analytics`)**

### 5.1.1.10. Frontend Screens

Insert full-screen captures of the corresponding Frontend UI screens for this Use Case.

![Project Analytics Selector screen](images/us-anl-001-ui-project-selector.png)

**Figure 5.1.1-3. Project Analytics Selector screen (`/analytics/projects`) displaying authorized project cards**

![Project Analytics Workspace Shell screen](images/us-anl-001-ui-analytics-shell.png)

**Figure 5.1.1-4. Read-only Project Analytics Workspace Shell (`/projects/:projectId/analytics` and embedded Workspace `Analytics` tab)**

![Project Analytics RBAC 403 Permission Denied screen](images/us-anl-001-ui-rbac-denied.png)

**Figure 5.1.1-5. RBAC Access Control screen (`403 · Permission denied`) when accessing an unauthorized project**
