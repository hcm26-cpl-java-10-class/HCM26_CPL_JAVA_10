### 5.1. Workspace Analytics

#### 5.1.2. US-ANL-002 – Sprint & Backlog Data Collection & Scope Filter Controls ([Author Name])

#### 5.1.2.1. Objective

Collect active Sprint and Product Backlog work items—together with their linked subtasks and bounded status-transition audit trails—through a single read-only analytics endpoint, and provide URL-persisted Scope, Sprint, Date Range, and Work Item Type filter controls that atomically recalculate KPIs and trend charts on **Apply** while rejecting invalid filter inputs with HTTP `422 Unprocessable Entity` without clearing previously loaded charts.

#### 5.1.2.2. Actors

- **Primary Actors:**
  - **Student (Team Member / Team Leader):** Filters Sprint and Product Backlog analytics within their assigned project(s).
  - **Mentor / Teacher:** Narrows project analytics by specific Sprint, Product Backlog, date window, or work item type to inspect team progress.
  - **Program Manager (PM) / Class Admin:** Filters analytics across managed class projects to review delivery performance.
  - **Administrator (`ADMIN` / `SUPER_ADMIN` / `PO`):** Filters Sprint and Backlog analytics across any active project in their tenant.
- **Supporting Actor:**
  - **System (Analytics Filter Bar, URL Query Parameter Sync, React Query `keepPreviousData` Layer, `ProjectAnalyticsController`, `ProjectAnalyticsService`, `ProjectAnalyticsWorkItemRepository`, and `ProjectAnalyticsErrors`):** Validates filter inputs, collects active work items and audit history in read-only mode, resolves effective chart windows and bucket granularity, and returns recalculated analytics payloads or field-keyed `422` validation errors.

#### 5.1.2.3. Preconditions

- The user is authenticated and authorized for the target project (`PROJECT_ANALYTICS_READ` permission, active user, active tenant, and valid project scope per **US-ANL-001**).
- The user has opened the Project Analytics workspace (`/projects/:projectId/analytics` or the embedded workspace tab `/management/workspaces/:id?tab=analytic`).
- The target project is active (`isActive = true`) and the initial analytics shell payload has loaded (supplying available `sprints`, `defaultSprintId`, `backlogItemCount`, `itemTypes`, and default `window`).

#### 5.1.2.4. Postconditions

- **Success (Valid Filters Applied):**
  - The chosen filter values (`scope`, `sprintId`, `startDate`, `endDate`, `itemType`) are persisted into the browser URL query string (while preserving unrelated query parameters such as `tab` and `project`), so the filtered view survives browser reloads, workspace navigation, and link sharing.
  - Any previously open drill-down drawer is closed to avoid displaying stale item lists from an earlier filter scope.
  - The backend collects only active work items (`isActive = true`) matching the applied scope, sprint, and work item type (plus active subtasks when `itemType = ALL`), resolves the effective window (`startDate`, `endDate`, `granularity`, `timeZone`), and returns freshly calculated KPIs and trend charts with `Cache-Control: no-store`.
  - No Sprint, Backlog item, Subtask, or mutation audit log is modified (`@Transactional(readOnly = true)`).
- **Failure (Invalid Filters – HTTP `422`):**
  - Previously loaded valid KPIs and charts remain rendered via `keepPreviousData` (never blanked out).
  - The user's draft filter controls remain editable, offending fields are highlighted (`border-destructive`, `aria-invalid="true"`), and field-specific validation feedback is displayed.

#### 5.1.2.5. Trigger

The user performs one of the following actions:
1. Changes one or more filter controls in the **Analytics Filter Bar** (**Scope**, **Sprint**, **Date** range `From` / `To`, or **Work item type**) and clicks **Apply**.
2. Clicks **Reset** on the filter bar (or **Reset Filters** on an empty filtered state) to return to the project's default analytics scope.
3. Opens a direct or shared Analytics URL containing query parameters (`scope`, `sprintId`, `startDate`, `endDate`, `itemType`).

#### 5.1.2.6. Main Flow

| Step | Actor | Action / System Response |
| --- | --- | --- |
| 1 | User | Views the Analytics workspace with the **Analytics Filter Bar** initialized from the current URL query parameters and the backend's filter echo (`filters` and `window`). |
| 2 | User | Selects a **Scope** from the Scope dropdown (`All work items` [`ALL`], `Product backlog` [`BACKLOG`], or `Sprint scope` [`SPRINT`]). Selecting `Sprint scope` auto-populates the Sprint selector with the active/default (or latest) sprint; selecting `All work items` or `Product backlog` clears the draft `sprintId`. |
| 3 | User | *(Optional)* Selects a specific **Sprint** from the Sprint dropdown (choosing a sprint automatically sets draft `scope` to `SPRINT`; choosing `All sprints` clears draft `sprintId`). |
| 4 | User | *(Optional)* Opens the **Date** popover, enters `From` (`startDate`) and/or `To` (`endDate`) dates (`YYYY-MM-DD`), and/or selects a **Work item type** (`All work item types`, `Story`, `Bug`, or `Task`). All edits stay in local draft state without sending intermediate API requests. |
| 5 | User | Clicks **Apply**. |
| 6 | Frontend | Closes any open drill-down drawer, writes the selected filter parameters to the URL via `writeAnalyticsFilters` (removing cleared analytics keys while keeping `tab` and `project` intact), disables filter controls with a loading indicator, and sends `GET /api/v1/projects/{projectId}/analytics` with the selected query parameters. |
| 7 | Backend | Authorizes the user and project (`ProjectAnalyticsAccess`), parses and validates `scope`, `itemType`, date range order (`startDate <= endDate`), and `sprintId` ownership within the project. |
| 8 | Backend | Queries active `SprintBacklog` records via `ProjectAnalyticsWorkItemRepository.findWorkItems` (matching `item.projectId = :projectId OR sprint.projectId = :projectId`, narrowed by `sprint is null` for `BACKLOG`, `sprint.id = :sprintId` for `SPRINT`, and `item.workType = :workType` if specified), loads active child `ProjectTask` subtasks when `itemType = ALL`, resolves the effective date window and `granularity` (`DAY` / `WEEK` / `MONTH`) in the tenant time zone, fetches status audit events up to `completionCutoff`, and recalculates KPIs and all trend charts. |
| 9 | Backend | Returns HTTP `200 OK` (`Cache-Control: no-store`) with the updated `ProjectAnalyticsResponse` containing echoed `filters`, effective `window`, `kpis`, `creationTrend`, `cycleTimeTrend`, `leadTimeTrend`, `completionTrend`, and `widgets`. |
| 10 | Frontend | Re-enables filter controls and atomically updates the header sprint/scope label, filter bar display, KPI summary cards, trend charts, and current-window work items list. |

#### 5.1.2.7. Alternative Flows and Exceptions

**5.1.2.7.1. Filtering Product Backlog Only (`scope=BACKLOG`)**

1. The user selects **Product backlog** in the Scope dropdown and clicks **Apply**.
2. The frontend sends `GET /api/v1/projects/{projectId}/analytics?scope=BACKLOG` (omitting `sprintId`).
3. The backend collects strictly active work items where `sprint IS NULL`, echoes `scope: "BACKLOG"` and `sprintId: null`, and updates all KPIs and charts for Product Backlog items only.

**5.1.2.7.2. Resetting Filters or Restoring the Default Date Window**

1. **Full Reset:** The user clicks **Reset** on the filter bar. The frontend closes any open drill-down drawer, calls `clearAnalyticsFilters` to remove `scope`, `sprintId`, `startDate`, `endDate`, and `itemType` from the URL (keeping `tab` and `project`), and re-queries `GET /api/v1/projects/{projectId}/analytics` with no filter parameters to restore defaults.
2. **Clear Date Bounds Only:** Inside the **Date** popover, if a custom `From` or `To` date is entered, the user can click **Use the default window** to clear both draft date fields and then click **Apply** so the backend derives the window automatically from project work item activity.

**5.1.2.7.3. Invalid or Rejected Filter Parameters (HTTP `422 Unprocessable Entity`)**

1. **Client-side Date Range Preview:** If the user selects a draft `From` date after the `To` date, `AnalyticsFilterBar` immediately highlights the Date button and inputs in red (`border-destructive`) and shows *"The end date must be on or after the start date."*
2. **Backend Semantic & Type Validation (`422`):** When an invalid filter reaches `GET /api/v1/projects/{projectId}/analytics`, `ProjectAnalyticsService` or `ProjectAnalyticsErrors` returns HTTP `422 Unprocessable Entity` (never `400`) with `{ status: 422, message: "The analytics filters are not valid", errors: { "<field>": ["<reason>"] } }`:
   - Inverted date range (`startDate > endDate`) → `endDate`: *"The end date must be on or after the start date"*.
   - Sprint belonging to another project or non-existent sprint → `sprintId`: *"The selected sprint does not belong to this project"*.
   - `scope=SPRINT` when the project has no active sprints → `sprintId`: *"This project has no sprint to analyse yet"*.
   - Unsupported `scope` value → `scope`: *"Scope must be one of ALL, BACKLOG or SPRINT"*.
   - Unsupported `itemType` value → `itemType`: *"Work item type must be one of ALL, STORY, BUG or TASK"*.
   - Unreadable parameter format (e.g., `sprintId=abc`, `startDate=2026-13-45`) → `BindException` / `MethodArgumentTypeMismatchException` mapped to HTTP `422` with the offending field name.
3. **Resilient UI Behavior:**
   - When previously loaded data exists (`keepPreviousData`), the charts and KPIs remain visible, the invalid control is highlighted in red, and an inline alert banner displays: *"<message>. The last valid charts are still shown — correct the highlighted filter and apply again."*
   - If the very first page load fails with `422` (no prior payload), `ProjectAnalyticsPage` renders the **422 · Filters not accepted** card with a **Clear filters** button.

**5.1.2.7.4. Empty Filtered Scope vs. Uninitialized Project**

1. If valid filters return zero matching work items (`scopeIsEmpty = true`), the frontend renders `AnalyticsEmptyState`:
   - **Empty filtered scope:** Displays *"No Sprint or Backlog items found for the selected filter"* with a **Reset Filters** button.
   - **Uninitialized project** (`sprints.length === 0` and `backlogItemCount === 0`): Displays *"No work item data available yet. Create items in Backlog or Sprint Board to see analytics."* with a **Go to Backlog** button.

**5.1.2.7.5. Malformed URL Query Parameters on Direct Load**

1. When loading `/projects/:projectId/analytics` or `?tab=analytic` from a manually edited URL, `readAnalyticsFilters` whitelist-validates `scope` (`ALL | BACKLOG | SPRINT`), `itemType` (`ALL | STORY | BUG | TASK`), `sprintId` (positive safe integer), and `startDate`/`endDate` (`YYYY-MM-DD`). Invalid URL fragments are safely ignored before issuing the request.

#### 5.1.2.8. Business Rules and Notes

1. **Read-Only Data Collection Scope:** Work items are queried from `sprint_backlog` where `isActive = true` and `(item.projectId = :projectId OR sprint.projectId = :projectId)`, ordered by `createdAt ASC, id ASC`. Active subtasks (`ProjectTask`, `isActive = true`) linked to the in-scope backlog items are included when `itemType` is `ALL` (unfiltered). Soft-deleted items and sprints are always excluded.
2. **Scope & Default Sprint Resolution:**
   - Supported `scope` values: `ALL` (all project work items), `BACKLOG` (`sprint IS NULL`), and `SPRINT` (items belonging to one sprint).
   - If `scope` is omitted: resolves to `SPRINT` when `sprintId` is provided, otherwise `ALL`.
   - If `scope = SPRINT` and `sprintId` is omitted: defaults to the project's `ACTIVE` sprint, or else the chronologically latest sprint; if the project has no sprints, returns `422` on `sprintId`.
   - When `scope` is `ALL` or `BACKLOG`, `sprintId` is ignored for aggregation and echoed as `null`.
   - The `filters.sprints` dropdown list is ordered chronologically (`startDate ASC NULLS LAST, id ASC`) and includes each sprint's active `workItemCount`.
3. **Supported Work Item Types:** `ALL`, `STORY`, `BUG`, and `TASK` (case-insensitive on backend parsing).
4. **Effective Date Window, Cap & Auto-Granularity:**
   - Requested `startDate` / `endDate` are echoed separately in `filters` (preserving blank fields if the user did not specify them), while the computed reporting window lives in `window`.
   - Default `window.startDate`: earliest work item/subtask creation date in the tenant time zone, or `today - 29 days` (30-day default window) when no activity exists.
   - Default `window.endDate`: latest of `today` (tenant time zone) and the latest work item/subtask creation/update date; clamped so `windowEnd >= windowStart`.
   - Maximum window safety cap: `365` days (`MAX_WINDOW_DAYS = 365`). If a requested window spans 365 or more days, `windowStart` is capped at `windowEnd - 364 days`.
   - Automatic chart bucket granularity: `<= 31` days → `DAY`; `32–120` days → `WEEK`; `> 120` days → `MONTH`.
5. **Tenant Time Zone & Completion Cutoff:** Creation/update dates and status-transition audit queries are evaluated in the tenant's configured time zone (fallback: `Asia/Ho_Chi_Minh`) and bounded by `completionCutoff` (end of `windowEnd`) so future transitions never contaminate historical filter windows.
6. **Draft-Then-Apply Interaction:** Editing filter controls updates local React draft state only; no API request is dispatched until the user clicks **Apply** or **Reset**. All controls are disabled while a query is in flight (`isFetching = true`).
7. **Dedicated HTTP `422` Error Contract:** `ProjectAnalyticsErrors` (`@Order(Ordered.HIGHEST_PRECEDENCE)`, scoped strictly to `ProjectAnalyticsController`) ensures all filter validation and parameter binding errors return HTTP `422 Unprocessable Entity` with a field-keyed `errors` map without changing the global `400` behavior of other modules.

### 5.1.2.9. Backend Testing Evidence on Swagger

Insert Swagger UI screenshots after executing the primary analytics data collection and filter validation test cases.

#### Test Case 1 – Valid Scoped & Filtered Analytics Query (`200 OK`)

- **API:** `GET /api/v1/projects/{projectId}/analytics` *(also mapped at `/api/projects/{projectId}/analytics`)*
- **Request Data:**
  - **Header:** `Authorization: Bearer <valid_jwt_token>`
  - **Path Parameter:** `projectId = 1`
  - **Query Parameters:** `scope=SPRINT&sprintId=4&startDate=2026-11-01&endDate=2026-11-23&itemType=STORY` *(additional smoke checks: `scope=BACKLOG` and `scope=ALL`)*
- **Expected Result:** HTTP `200 OK` with header `Cache-Control: no-store` and a `ProjectAnalyticsResponse` echoing the applied filters, effective window (`granularity: "DAY"`), `sprints` list with counts, `backlogItemCount`, recalculated `kpis`, and trend chart payloads:
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
      "itemType": "STORY",
      "startDate": "2026-11-01",
      "endDate": "2026-11-23",
      "sprints": [
        {
          "sprintId": 4,
          "name": "Sprint 4",
          "status": "ACTIVE",
          "startDate": "2026-11-16",
          "endDate": "2026-11-29",
          "workItemCount": 14
        }
      ],
      "defaultSprintId": 4,
      "backlogItemCount": 6,
      "itemTypes": ["ALL", "STORY", "BUG", "TASK"]
    },
    "window": {
      "startDate": "2026-11-01",
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
- **Actual Result:** `[Insert HTTP status code, e.g., 200 OK, Cache-Control: no-store header, and summary of returned filtered payload]`

![Swagger test result for valid scoped analytics query](images/us-anl-002-swagger-valid-filter.png)

**Figure 5.1.2-1. Swagger API test result for collecting filtered Sprint & Backlog analytics (`GET /api/v1/projects/{projectId}/analytics` – `200 OK`)**

---

#### Test Case 2 – Invalid Filter Rejection (`422 Unprocessable Entity`)

- **API:** `GET /api/v1/projects/{projectId}/analytics`
- **Request Data:**
  - **Header:** `Authorization: Bearer <valid_jwt_token>`
  - **Path Parameter:** `projectId = 1`
  - **Query Parameters:** `scope=SPRINT&startDate=2026-11-23&endDate=2026-11-01` *(inverted date range; also testable with another project's `sprintId` or `scope=INVALID`)*
- **Expected Result:** HTTP `422 Unprocessable Entity` with a field-keyed validation body:
  ```json
  {
    "status": 422,
    "message": "The analytics filters are not valid",
    "errors": {
      "endDate": [
        "The end date must be on or after the start date"
      ]
    }
  }
  ```
- **Actual Result:** `[Insert HTTP status code, e.g., 422 Unprocessable Entity, and actual error response body]`

![Swagger test result for HTTP 422 invalid analytics filter](images/us-anl-002-swagger-invalid-filter-422.png)

**Figure 5.1.2-2. Swagger API test result for invalid analytics filter validation (`GET /api/v1/projects/{projectId}/analytics` – `422 Unprocessable Entity`)**

### 5.1.2.10. Frontend Screens

Insert full-screen captures of the corresponding Frontend UI screens for this Use Case.

![Analytics Filter Bar with Scope, Sprint, Date Range and Work Item Type applied](images/us-anl-002-ui-filter-bar-applied.png)

**Figure 5.1.2-3. Analytics Filter Bar displaying Scope, Sprint, Date range popover, Work item type controls, and URL-persisted filtered results**

![Analytics Filter validation 422 preserving existing charts](images/us-anl-002-ui-filter-validation-422.png)

**Figure 5.1.2-4. Invalid filter handling (`422` / inverted date range) highlighting the offending control while keeping previously loaded charts visible**

![Analytics empty filtered scope state with Reset Filters button](images/us-anl-002-ui-empty-filtered-scope.png)

**Figure 5.1.2-5. Empty filtered scope state (*"No Sprint or Backlog items found for the selected filter"*) with Reset Filters action**
