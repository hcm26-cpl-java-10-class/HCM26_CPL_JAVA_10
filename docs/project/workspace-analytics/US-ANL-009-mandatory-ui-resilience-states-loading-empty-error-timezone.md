### 5.1. Workspace Analytics

#### 5.1.9. US-ANL-009 – Mandatory UI Resilience States (Loading, Empty, Error & Timezone) ([Author Name])

#### 5.1.9.1. Objective

Guarantee that the Project Analytics workspace handles every non-ideal runtime condition gracefully—preventing premature zero/empty flickers during data loads with tailored skeletons, distinguishing brand-new uninitialized projects from empty filtered scopes with actionable CTAs, surfacing sanitized error states with scoped **Retry** recovery (never raw stack traces), and applying consistent tenant time zone conversion across all backend date aggregations and frontend timestamps.

#### 5.1.9.2. Actors

- **Primary Actors:**
  - **Student (Team Member / Team Leader):** Experiences smooth skeleton loading, clear empty-project onboarding (**Go to Backlog**), safe retry actions, and accurate local-date bucketing in their organization's time zone.
  - **Mentor / Teacher:** Relies on unambiguous empty/error states and consistent tenant-timezone reporting when reviewing teams across different browser locales.
  - **Program Manager (PM) / Class Admin:** Verifies accurate midnight boundary attribution and recovers cleanly from transient backend errors without losing workspace context.
  - **Administrator (`ADMIN` / `SUPER_ADMIN` / `PO`):** Configures tenant time zones (`Tenant.timezone`) and monitors resilient analytics views across all active projects.
- **Supporting Actor:**
  - **System (`ProjectAnalyticsPage`, `AnalyticsKpiCards`, `AnalyticsFilterBar`, Chart Cards, `AnalyticsDrillDownDrawer`, `analytics-chart-ui`, `ProjectAnalyticsService`, `ProjectAnalyticsErrors`, and `Tenant`):** Coordinates skeleton loaders, empty-state detection, sanitized error responses with retry hooks, and end-to-end IANA time zone resolution.

#### 5.1.9.3. Preconditions

- The user is authenticated and authorized to access the Project Analytics workspace (`PROJECT_ANALYTICS_READ` per **US-ANL-001**).
- The user navigates to `/projects/:projectId/analytics`, `/analytics/projects`, or `/management/workspaces/:id?tab=analytic`.
- The user's `Tenant` record exists and is active, optionally carrying a configured IANA `timezone` value (defaulting to `Asia/Ho_Chi_Minh` when unset or invalid).

#### 5.1.9.4. Postconditions

- **Loading State:** Animated layout-matched skeletons (`ShellLoading`, 4-card `AnalyticsKpiCards` skeletons, `ChartSkeleton` bar/line variants, and drawer card skeletons) occupy the exact container geometry until requests settle—zero `'0'` or empty-state flashes occur while loading.
- **Empty State:** Uninitialized projects display an illustrated **Go to Backlog** onboarding card, whereas empty filtered scopes display an illustrated **Reset Filters** card; partial empty widgets display subtle per-card overlays without hiding populated sibling charts.
- **Error State:** Transient failures (`500` / network timeout) never display raw stack traces or technical exceptions; instead, sanitized messages and scoped **Retry** buttons allow instant recovery via `query.refetch()`.
- **Timezone Consistency:** Every chart date bucket, window bound, completion cutoff, and header `Updated today at HH:mm (<timeZone>)` stamp reflects the resolved tenant IANA time zone consistently regardless of client browser locale or storage server time zone.

#### 5.1.9.5. Trigger

1. **Loading:** User opens Project Analytics, clicks **Apply** / **Reset** on filters, opens the drill-down drawer, or triggers **Retry**.
2. **Empty:** User opens a newly created project with 0 sprints and 0 backlog items, or applies valid filters that match 0 work items.
3. **Error:** Backend returns HTTP `500` (or `401`/`403`/`404`/`422`) or a network outage interrupts `GET /api/v1/projects/{projectId}/analytics` or `/drill-down`.
4. **Timezone Resolution:** Any analytics request executes for a tenant with a configured `Tenant.timezone` (e.g., `Asia/Ho_Chi_Minh`, `UTC`, `America/New_York`) or work items created/completed near midnight boundaries.

#### 5.1.9.6. Main Flow

| Step | Actor | Action / System Response |
| --- | --- | --- |
| 1 | User | Navigates to the Project Analytics workspace (`/projects/:projectId/analytics` or embedded `?tab=analytic`). |
| 2 | Frontend | While `query.isPending` is true (initial load), renders `ShellLoading` (`role="status"`) containing header, filter bar, 4 KPI shimmer cards, 4 bar/line `ChartSkeleton` cards, and work-item list skeletons so no `'0'` values or empty placeholders flash. |
| 3 | Backend | Resolves the effective tenant IANA time zone (`tenantZone`) in priority order (`Tenant.timezone` → `app.analytics.tenant-time-zone` → `Asia/Ho_Chi_Minh`) and storage zone (`storageZone`, defaulting to `ZoneId.systemDefault()`). |
| 4 | Backend | Converts all `LocalDateTime` creation, update, and status-audit timestamps from `storageZone` into `tenantZone` (`toTenantDate`), computes `completionCutoff` at the end of `windowEnd` in `tenantZone`, and stamps `timeZone` on `window`, `creationTrend`, `cycleTimeTrend`, `leadTimeTrend`, and `completionTrend`. |
| 5 | Backend | Returns HTTP `200 OK` (`Cache-Control: no-store`) with `state: "READY"` or `"EMPTY"` on each trend payload and widget. |
| 6 | Frontend | Evaluates `scopeIsEmpty` (only after `!query.isFetching && !transientError`): if data exists, renders the KPI cards, trend charts, and header timestamp formatted in `tenantTimeZone` (`Updated today at HH:mm (<tenantTimeZone>)`). |
| 7 | User | Applies new filters in `AnalyticsFilterBar`; controls disable with a loading spinner while KPI cards and every chart container transition seamlessly to `isLoading` skeletons (`AnalyticsKpiCards` + `ChartSkeleton`) until the refreshed payload arrives. |

#### 5.1.9.7. Alternative Flows and Exceptions

**5.1.9.7.1. Uninitialized Project Empty State (0 Sprints and 0 Backlog Items)**

1. The backend returns `filters.sprints = []`, `filters.backlogItemCount = 0`, `total-work-items = "0"`, and `state = "EMPTY"` across all trends and widgets.
2. `ProjectAnalyticsPage` detects `uninitializedProject = true` and `scopeIsEmpty = true`, disables the **Export report** button (*"No data available to export"*), and renders `AnalyticsEmptyState` with a `FolderOpen` icon, title **"No work item data available yet"**, guidance (*"No work item data available yet. Create items in Backlog or Sprint Board to see analytics."*), and a primary **Go to Backlog** CTA button (`?tab=backlog` inside a workspace, or `/backlogs` standalone).

**5.1.9.7.2. Empty Filtered Scope State (Valid Filters Match 0 Items)**

1. The project has work items overall, but the applied Sprint, Work Item Type, or Date Range filter matches zero items (`uninitializedProject = false`, `scopeIsEmpty = true`).
2. `ProjectAnalyticsPage` renders `AnalyticsEmptyState` with an `Inbox` icon, title **"No Sprint or Backlog items found"**, message *"No Sprint or Backlog items found for the selected filter"*, and a **Reset Filters** button that clears all analytics URL parameters and restores the default view.

**5.1.9.7.3. Partial Empty Widget State**

1. When work items exist in scope (e.g., created items in `creationTrend`) but zero items are completed yet, `cycleTimeTrend`, `leadTimeTrend`, and `completionTrend` return `state = "EMPTY"`.
2. Because `scopeIsEmpty` is `false`, the full dashboard remains visible: `AnalyticsKpiCards` shows `0.0%` / `N/A`, `WorkItemCreationTrendCard` renders its stacked bars, and each empty completion/cycle/lead card shows a subtle centered overlay (*"No work items completed in this window"*) without disrupting sibling widgets.

**5.1.9.7.4. Transient Backend or Network Error (`500` / Timeout) & Scoped Retry**

1. If an unexpected backend exception occurs, `ProjectAnalyticsErrors.failed(...)` logs the stack trace server-side and returns a sanitized HTTP `500` payload: `{ status: 500, message: "The analytics data could not be loaded; please try again", errors: {} }`.
2. On the frontend, `ProjectAnalyticsPage` displays an inline `role="alert"` banner (*"Unable to load analytics data right now. Please try again."*) with a **Retry** button and renders `WidgetInlineError` (with scoped **Retry** buttons) inside affected chart cards—never exposing raw Java/Axios stack traces.
3. Clicking any **Retry** button disables the button with a spinning `RefreshCw` icon and invokes `query.refetch()` to recover seamlessly.
4. Similarly, transient errors in `AnalyticsDrillDownDrawer` render `WidgetInlineError` (*"Could not load the work items for this date. Please try again."*) with a scoped **Retry** button, and errors in `ProjectAnalyticsIndexPage` render a **Try again** button.

**5.1.9.7.5. Invalid or Unconfigured Time Zone String Fallback**

1. If `Tenant.timezone` or `app.analytics.tenant-time-zone` is blank or contains an invalid zone ID, `ProjectAnalyticsService.parseZoneOrNull(...)` catches `DateTimeException` and safely falls back to **`Asia/Ho_Chi_Minh`**.
2. On the frontend, `formatLocalTime(value, timeZone)` wraps `Intl.DateTimeFormat` in a `try/catch` block so an unsupported browser time zone identifier falls back gracefully to local browser formatting without crashing the page.

#### 5.1.9.8. Business Rules and Notes

1. **Zero-Flicker Loading Contract:** `scopeIsEmpty` explicitly guards on `!query.isFetching && !transientError`, and every card switches to `ChartSkeleton` (matching `bar` or `line` geometry) or `AnalyticsKpiCards` skeletons during both initial load (`isPending`) and filter refresh (`isFetching`), ensuring zero or empty states never flash mid-request.
2. **Two-Tier Empty State Logic:**
   - `uninitializedProject = (filters.sprints.length === 0 && filters.backlogItemCount === 0)` → renders **Go to Backlog** CTA (plus **Reset Filters** if active query filters exist).
   - Otherwise when `scopeIsEmpty` is true (all four primary trend states and all widget states equal `"EMPTY"` and `total-work-items === "0"` or `creationTrend.state === "EMPTY"`) → renders **Reset Filters** CTA.
3. **Sanitized Error Envelope (`ProjectAnalyticsErrors`):** All unhandled exceptions return `{ status: 500, message: "The analytics data could not be loaded; please try again", errors: {} }`; authentication (`401`), authorization (`403`), missing/malformed project (`404`), and filter validation (`422`) each map to dedicated, user-friendly UI states without leaking internal diagnostics.
4. **Tenant Time Zone Resolution Hierarchy:**
   1. `user.getTenant().getTimezone()` (`Tenant.timezone`)
   2. Persisted `TenantRepository.findById(tenantId)` → `Tenant.timezone`
   3. Spring property `app.analytics.tenant-time-zone` (fallback `app.notification.backlog-time-zone`)
   4. Hardcoded fallback: `Asia/Ho_Chi_Minh`
5. **Storage-to-Tenant Midnight Boundary Accuracy:** Database `LocalDateTime` timestamps are interpreted in `storageZone()` (`app.analytics.storage-time-zone`, defaulting to `ZoneId.systemDefault()`) and converted via `atZone(serverZone).withZoneSameInstant(tenantZone)` before extracting `LocalDate` buckets or computing `completionCutoff = windowEnd.plusDays(1).atStartOfDay(tenantZone).withZoneSameInstant(serverZone).toLocalDateTime().minusNanos(1)`.
6. **Consistent Timezone Propagation:** The resolved IANA time zone string is returned identically across `window.timeZone`, `creationTrend.timeZone`, `cycleTimeTrend.timeZone`, `leadTimeTrend.timeZone`, and `completionTrend.timeZone`, and displayed in the page header as `Updated today at HH:mm (<timeZone>)`.

### 5.1.9.9. Backend Testing Evidence on Swagger

Insert Swagger UI screenshots verifying tenant timezone propagation, empty-state metadata, and sanitized error envelopes.

#### Test Case 1 – Tenant Timezone Propagation & Empty-Scope Metadata (`200 OK`)

- **API:** `GET /api/v1/projects/{projectId}/analytics` *(also mapped at `/api/projects/{projectId}/analytics`)*
- **Request Data:**
  - **Header:** `Authorization: Bearer <valid_jwt_token>`
  - **Path Parameter:** `projectId = 1` *(test both a populated project to verify `window.timeZone` / trend `timeZone` fields and an empty project or non-matching filter such as `startDate=2025-01-01&endDate=2025-01-07`)*
- **Expected Result:** HTTP `200 OK` with `Cache-Control: no-store`, consistent `timeZone` (e.g., `"Asia/Ho_Chi_Minh"` or the tenant's configured `Tenant.timezone`) across `window` and all four trend objects, and clean `state: "EMPTY"` indicators when no work items match:
  ```json
  {
    "projectId": 1,
    "readOnly": true,
    "filters": {
      "scope": "ALL",
      "sprints": [],
      "backlogItemCount": 0
    },
    "window": {
      "startDate": "2026-10-25",
      "endDate": "2026-11-23",
      "granularity": "DAY",
      "timeZone": "Asia/Ho_Chi_Minh"
    },
    "kpis": [
      { "key": "total-work-items", "value": "0" },
      { "key": "completion-rate", "value": "0.0%" },
      { "key": "avg-cycle-time", "value": "N/A" },
      { "key": "avg-lead-time", "value": "N/A" }
    ],
    "creationTrend": { "state": "EMPTY", "timeZone": "Asia/Ho_Chi_Minh", "buckets": [] },
    "cycleTimeTrend": { "state": "EMPTY", "timeZone": "Asia/Ho_Chi_Minh", "points": [] },
    "leadTimeTrend": { "state": "EMPTY", "timeZone": "Asia/Ho_Chi_Minh", "points": [] },
    "completionTrend": { "state": "EMPTY", "timeZone": "Asia/Ho_Chi_Minh", "buckets": [] }
  }
  ```
- **Actual Result:** `[Insert HTTP status code, e.g., 200 OK, confirming consistent timeZone across window and trend payloads and clean EMPTY states]`

![Swagger test result for timezone propagation and empty state payload](images/us-anl-009-swagger-timezone-empty.png)

**Figure 5.1.9-1. Swagger API test result confirming tenant `timeZone` propagation and clean `EMPTY` state structure (`GET /api/v1/projects/{projectId}/analytics`)**

---

#### Test Case 2 – Sanitized Error Response Envelope (No Stack Trace Exposure)

- **API:** `GET /api/v1/projects/{projectId}/analytics`
- **Request Data:**
  - **Header:** `Authorization: Bearer <valid_jwt_token>`
  - **Path Parameter:** `projectId = 99999` *(for `404`)* / unauthorized `projectId` *(for `403`)* / invalid filter *(for `422`)* / simulated backend failure *(for `500`)*
- **Expected Result:** Uniform sanitized JSON structure `{ status, message, errors }` with zero stack traces or internal exception class names (example for `500`):
  ```json
  {
    "status": 500,
    "message": "The analytics data could not be loaded; please try again",
    "errors": {}
  }
  ```
- **Actual Result:** `[Insert HTTP status code and sanitized JSON response body confirming no stack trace or internal error leak]`

![Swagger test result for sanitized analytics error envelope](images/us-anl-009-swagger-sanitized-error.png)

**Figure 5.1.9-2. Swagger API test result verifying the sanitized error contract (`ProjectAnalyticsErrors`) with no raw stack trace exposure**

### 5.1.9.10. Frontend Screens

Insert full-screen captures of the corresponding Frontend UI resilience states for this Use Case.

![Analytics ShellLoading and ChartSkeleton loading state](images/us-anl-009-ui-loading-skeleton.png)

**Figure 5.1.9-3. Loading state displaying `ShellLoading`, KPI shimmer cards, and bar/line `ChartSkeleton` loaders with zero flicker**

![Analytics empty state for uninitialized project and empty filter](images/us-anl-009-ui-empty-states.png)

**Figure 5.1.9-4. Empty state screens distinguishing an uninitialized project (**Go to Backlog**) from an empty filtered scope (**Reset Filters**)**

![Analytics inline error banner and WidgetInlineError with Retry button](images/us-anl-009-ui-error-retry.png)

**Figure 5.1.9-5. Transient error resilience state showing sanitized alert banner, scoped `WidgetInlineError` cards with **Retry** buttons, and tenant timezone timestamp in the header**
