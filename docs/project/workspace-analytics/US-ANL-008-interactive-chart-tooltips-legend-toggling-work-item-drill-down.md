### 5.1. Workspace Analytics

#### 5.1.8. US-ANL-008 – Interactive Chart Tooltips, Legend Toggling & Work Item Drill-Down ([Author Name])

#### 5.1.8.1. Objective

Provide interactive data exploration across all four analytics charts (**Work item creation trend**, **Work item cycle time**, **Work item lead time**, and **Work item completion trend**) through floating contextual hover tooltips, clickable series legend toggles with automatic Y-axis rescaling, a slide-over Work Item Drill-Down drawer backed by a dedicated read-only API endpoint, and direct read-only inspection of individual work items in the task detail sheet.

#### 5.1.8.2. Actors

- **Primary Actors:**
  - **Student (Team Member / Team Leader):** Inspects exact daily metrics, isolates individual series, and drills down into specific work items causing spikes or open carry-over.
  - **Mentor / Teacher:** Investigates outlier cycle/lead times and reviews exact work item details (assignee, status, sprint, cycle/lead days) directly from chart anomalies.
  - **Program Manager (PM) / Class Admin:** Explores granular work item lists behind aggregate trends across managed class projects.
  - **Administrator (`ADMIN` / `SUPER_ADMIN` / `PO`):** Performs interactive chart exploration and drill-down across any active project within their tenant.
- **Supporting Actor:**
  - **System (`analytics-chart-ui`, Chart Cards, `AnalyticsDrillDownDrawer`, `BacklogItemDetailSheet`, `ProjectAnalyticsController`, `ProjectAnalyticsService`, and `ProjectAnalyticsWorkItemRepository`):** Renders floating tooltips and legend toggles, fetches filtered drill-down work item rows via `GET /api/v1/projects/{projectId}/analytics/drill-down` in read-only mode, resolves assignee display names, and enforces RBAC and validation rules.

#### 5.1.8.3. Preconditions

- The user is authenticated and authorized to view project analytics (`PROJECT_ANALYTICS_READ` permission and valid tenant/project scope per **US-ANL-001**).
- The user has opened the Project Analytics workspace (`/projects/:projectId/analytics` or `/management/workspaces/:id?tab=analytic`) and at least one of the four analytics charts has loaded data (`state = "READY"`).
- Active scope/sprint/date/type filters (per **US-ANL-002**) are available in the URL so drill-down requests preserve the exact same filter scope.

#### 5.1.8.4. Postconditions

- **Success:**
  - Hovering over any bar or line point displays a floating tooltip with exact formatted date, visible series values (counts + percentage shares for stacked bars; 1-decimal days + item counts for line charts), and drill-down guidance.
  - Clicking any legend item toggles that series on/off (`opacity-40 line-through` when hidden), dynamically rescales the chart's Y-axis domain, and updates tooltip entries.
  - Clicking a bar segment or line node marker opens `AnalyticsDrillDownDrawer` populated with the exact underlying work items (`taskCode`, `workType`, `status`, `title`, `assigneeName`, `sprintName`, `cycleDays`, `leadDays`) matching the active analytics filters, clicked chart, date, and series.
  - Clicking **Open detail** on any drill-down row opens `BacklogItemDetailSheet` in strictly read-only mode (`canEdit = false`, `canMove = false`, `canDelete = false`, `readOnly = true`) without mutating any project data.
- **Zero Matches / Validation Error / Failure:**
  - Displays clear empty-drawer messaging, HTTP `422` validation errors for invalid drill-down query parameters, or an inline `WidgetInlineError` with a scoped **Retry** button.

#### 5.1.8.5. Trigger

1. **Tooltip Inspection:** The user hovers their pointer over a stacked bar or line node marker on any of the four trend charts.
2. **Legend Toggling:** The user clicks (or activates via keyboard) a `LegendToggleButton` in any chart header.
3. **Work Item Drill-Down:** The user clicks a stacked bar segment (`creation`, `completion`), a line node marker (`activeDot`), or a chart date column (`cycle-time`, `lead-time`), and optionally switches the series filter pills inside the drawer or clicks **Open detail** on a work item card.

#### 5.1.8.6. Main Flow

| Step | Actor | Action / System Response |
| --- | --- | --- |
| 1 | User | Hovers over a bar or data point on one of the four analytics charts. |
| 2 | Frontend | Renders `StackedBarTooltip` (for `creation`/`completion`, showing `Date`, each visible series' count and 1-decimal percentage share, and visible `Total`) or `MetricLineTooltip` (for `cycle-time`/`lead-time`, showing `Date`, each visible non-null series' 1-decimal average days, and completed item count). |
| 3 | User | *(Optional)* Clicks a `LegendToggleButton` in a chart header to isolate or compare specific series. |
| 4 | Frontend | Toggles the series visibility (`aria-pressed`), dims hidden buttons to `40%` opacity with strikethrough, recalculates the chart's `yDomainMax` strictly from visible series, and adjusts top-corner rounding on stacked bars. |
| 5 | User | Clicks a bar segment or line node marker on a chart. |
| 6 | Frontend | Sets `drillDownTarget = { chart, date, series? }`, opens the right-hand slide-over `AnalyticsDrillDownDrawer` showing 4 skeleton cards, and sends `GET /api/v1/projects/{projectId}/analytics/drill-down` with `chart`, `date`, optional `series`, and all currently applied analytics filters. |
| 7 | Backend | Verifies `@PreAuthorize("hasAuthority('PROJECT_ANALYTICS_READ')")`, validates `chart` (`creation | cycle-time | lead-time | completion`) and required ISO `date`, normalizes `series` (`"all"` → `null`), resolves the authorized project and active filter scope via `resolveScope(...)`, and matches exact `SprintBacklog` items and linked `ProjectTask` subtasks using the identical chart calculation rules. |
| 8 | Backend | Batch-resolves assignee display names (`findAssigneeNames` and `findSubtaskAssigneeNames`), attaches per-item `cycleDays` and `leadDays` (rounded to 1 decimal), sorts rows deterministically (descending `cycleDays` for `cycle-time`, descending `leadDays` for `lead-time`, ascending `taskCode` for `creation`/`completion`), and returns HTTP `200 OK` (`Cache-Control: no-store`). |
| 9 | Frontend | Renders the item count badge, date caption, in-drawer series filter pills, and scrollable work item cards (highlighting `Cycle` for `cycle-time` and `Lead` for `lead-time`). |
| 10 | User | *(Optional)* Switches series filter pills inside the drawer (re-querying with the new `series`) or clicks **Open detail** on a row to inspect the work item in the read-only `BacklogItemDetailSheet`. |

#### 5.1.8.7. Alternative Flows and Exceptions

**5.1.8.7.1. Switching Series Filter Pills Inside the Drill-Down Drawer**

1. For multi-series charts (`creation`: `All | Done | To Do`; `lead-time`: `All types | Story | Subtask | Task`; `completion`: `All types | Subtask | Story | Task`), the user clicks a series pill in the drawer header (`role="group"`).
2. `onChangeTarget({ ...target, series: option.value })` updates the query key and dispatches a fresh `GET /api/v1/projects/{projectId}/analytics/drill-down` request without closing the drawer.

**5.1.8.7.2. Inspecting a Subtask Row via "Open detail"**

1. For a `SUBTASK` item, the backend constructs `taskCode` as `<PREFIX>-<parentId> · SUB-<shortUuid>` and populates `backlogItemId` with the parent backlog item's ID.
2. Clicking **Open detail** extracts the parent item key (`taskCode.split(" · ")[0]`) and opens `BacklogItemDetailSheet` in read-only mode (`canEdit={false}`, `canMove={false}`, `canDelete={false}`, `readOnly`). If `backlogItemId` is `null`, the **Open detail** button is omitted.

**5.1.8.7.3. Hiding All Series on a Chart**

1. If the user toggles off every visible legend button on a chart, the chart area displays a centered non-breaking overlay (*"All series hidden — click a legend item to show"* or *"Series hidden — click the legend item to show"*) while keeping legend buttons interactive to re-enable any series.

**5.1.8.7.4. Auto-Closing the Drawer When Scope Filters Change**

1. If the user applies or resets filters in `AnalyticsFilterBar` (**US-ANL-002**), `ProjectAnalyticsPage` resets `drillDownTarget` to `null` so an outdated drill-down list from a prior scope never remains open.

**5.1.8.7.5. Invalid Drill-Down Query Parameters (HTTP `422 Unprocessable Entity`)**

1. If `chart` is missing or not one of `creation`, `cycle-time`, `lead-time`, or `completion`, `ProjectAnalyticsService.parseDrillDownChart` throws `ProjectAnalyticsValidationException("chart", "Chart must be one of creation, cycle-time, lead-time or completion")` → HTTP `422`.
2. If `date` is missing or not a valid ISO date (`YYYY-MM-DD`), `ProjectAnalyticsErrors` maps the binding/validation error to HTTP `422` (`errors.date`).

**5.1.8.7.6. Empty Drill-Down Results or Transient Error**

1. **Zero Matching Items:** If `items` is empty (e.g., switching to a series with 0 items on that date), the drawer displays *"No matching work items — No work items match this date and series in the active analytics scope."*
2. **Transient Error (`500` / Network Failure):** The drawer displays `WidgetInlineError` (*"Could not load the work items for this date. Please try again."*) with a scoped **Retry** button invoking `query.refetch()`.

#### 5.1.8.8. Business Rules and Notes

1. **Exact Chart-to-Drawer Parity:** Each `chart` branch in `ProjectAnalyticsService.drillDown(...)` reuses the identical scope resolution, `completionCutoff`, reopened-item exclusion, `backlogCompletedOn`/`subtaskCompletedOn`, `cycleSample`/`subtaskCycleSample`, and `backlogLeadSample`/`subtaskLeadSample` helpers as the four chart endpoints, guaranteeing `drillDown.totalCount` matches the hovered chart bar/point count.
2. **Deterministic Outlier-First Ordering:**
   - `cycle-time`: sorted by `cycleDays DESC NULLS LAST`, then `taskCode ASC`.
   - `lead-time`: sorted by `leadDays DESC NULLS LAST`, then `taskCode ASC`.
   - `creation` and `completion`: sorted by `taskCode ASC`.
3. **Tooltip Precision & Dynamic Totals:**
   - `StackedBarTooltip` calculates percentages strictly against the **currently visible** stacked total to 1 decimal place (`0.0%` if total is 0).
   - `MetricLineTooltip` formats averages to 1 decimal place (`X.X days`) and omits `null` series on sparse dates.
4. **Legend Accessibility & Rescaling:** Every `LegendToggleButton` renders a native `<button type="button">` with `aria-pressed` and descriptive `aria-label` (`"Hide/Show <Label> series"`). Toggling recalculates `yDomainMax` immediately without issuing any network call.
5. **Strict Read-Only Enforcement & No Caching:** `GET /api/v1/projects/{projectId}/analytics/drill-down` is a `@Transactional(readOnly = true)` `GET` endpoint protected by `@PreAuthorize("hasAuthority('PROJECT_ANALYTICS_READ')")` + `ProjectAnalyticsAccess`, returning `Cache-Control: no-store`. The frontend drawer query sets `staleTime: 0`, `gcTime: 0`, `retry: false`, and opens `BacklogItemDetailSheet` with `readOnly = true`.
6. **Assignee Resolution Across Models:** Backlog assignees resolve via `ProjectMember → ClassMember → User`; subtask assignees resolve via `TaskAlertMemberLink` covering both `PROJECT_MEMBER` and legacy `TEAM_MEMBER` links, formatting `"<firstName> <lastName>"` with fallback to `email` (or `"Unassigned"` in UI when `null`).

### 5.1.8.9. Backend Testing Evidence on Swagger

Insert Swagger UI screenshots verifying the dedicated click-to-drill-down API endpoint for valid drill-down queries and invalid parameter validation.

#### Test Case 1 – Drill Down on a Chart Date & Series (`200 OK`)

- **API:** `GET /api/v1/projects/{projectId}/analytics/drill-down` *(also mapped at `/api/projects/{projectId}/analytics/drill-down`)*
- **Request Data:**
  - **Header:** `Authorization: Bearer <valid_jwt_token>`
  - **Path Parameter:** `projectId = 1`
  - **Query Parameters:** `chart=lead-time&date=2026-11-12&series=story&scope=ALL` *(also testable with `chart=creation&series=done`, `chart=cycle-time`, and `chart=completion&series=subtask`)*
- **Expected Result:** HTTP `200 OK` with header `Cache-Control: no-store` and a `ProjectAnalyticsDrillDownResponse` listing matching work items sorted by `leadDays` descending (for `lead-time`), with resolved `taskCode`, `assigneeName`, `sprintName`, `cycleDays`, and `leadDays`:
  ```json
  {
    "projectId": 1,
    "projectCode": "PRJ-ECOM-01",
    "chart": "lead-time",
    "date": "2026-11-12",
    "series": "story",
    "totalCount": 2,
    "items": [
      {
        "id": "104",
        "backlogItemId": 104,
        "taskCode": "PRJ-ECOM-01-104",
        "title": "Implement checkout payment validation",
        "workType": "STORY",
        "status": "DONE",
        "assigneeName": "Nguyen Minh Anh",
        "sprintId": 4,
        "sprintName": "Sprint 4",
        "createdDate": "2026-11-06",
        "completedDate": "2026-11-12",
        "cycleDays": 2.3,
        "leadDays": 6.1
      },
      {
        "id": "109",
        "backlogItemId": 109,
        "taskCode": "PRJ-ECOM-01-109",
        "title": "Build order confirmation email template",
        "workType": "STORY",
        "status": "DONE",
        "assigneeName": "Tran Quoc Bao",
        "sprintId": 4,
        "sprintName": "Sprint 4",
        "createdDate": "2026-11-08",
        "completedDate": "2026-11-12",
        "cycleDays": 1.5,
        "leadDays": 3.9
      }
    ]
  }
  ```
- **Actual Result:** `[Insert HTTP status code, e.g., 200 OK, Cache-Control: no-store header, totalCount, and sample returned items]`

![Swagger test result for GET /api/v1/projects/{projectId}/analytics/drill-down](images/us-anl-008-swagger-drill-down-200.png)

**Figure 5.1.8-1. Swagger API test result for Work Item Drill-Down (`GET /api/v1/projects/{projectId}/analytics/drill-down` – `200 OK`)**

---

#### Test Case 2 – Invalid Drill-Down Chart Parameter (`422 Unprocessable Entity`)

- **API:** `GET /api/v1/projects/{projectId}/analytics/drill-down`
- **Request Data:**
  - **Header:** `Authorization: Bearer <valid_jwt_token>`
  - **Path Parameter:** `projectId = 1`
  - **Query Parameters:** `chart=unknown&date=2026-11-12`
- **Expected Result:** HTTP `422 Unprocessable Entity` with a field-keyed validation error on `chart`:
  ```json
  {
    "status": 422,
    "message": "The analytics filters are not valid",
    "errors": {
      "chart": [
        "Chart must be one of creation, cycle-time, lead-time or completion"
      ]
    }
  }
  ```
- **Actual Result:** `[Insert HTTP status code, e.g., 422 Unprocessable Entity, and actual error response body]`

![Swagger test result for invalid drill-down chart parameter](images/us-anl-008-swagger-drill-down-422.png)

**Figure 5.1.8-2. Swagger API test result for invalid drill-down chart validation (`422 Unprocessable Entity`)**

### 5.1.8.10. Frontend Screens

Insert full-screen captures of the corresponding Frontend UI screens for this Use Case.

![Interactive hover tooltip and legend toggling on analytics charts](images/us-anl-008-ui-tooltip-legend.png)

**Figure 5.1.8-3. Interactive floating hover tooltips (`StackedBarTooltip` / `MetricLineTooltip`) and series legend toggling with automatic Y-axis rescaling**

![Analytics Drill-Down slide-over drawer](images/us-anl-008-ui-drill-down-drawer.png)

**Figure 5.1.8-4. Work Item Drill-Down slide-over drawer displaying matched work items, series filter pills, assignee, status, Cycle/Lead days, and Open detail actions**

![Read-only BacklogItemDetailSheet opened from drill-down drawer](images/us-anl-008-ui-readonly-task-detail.png)

**Figure 5.1.8-5. Read-only Task Detail sheet opened directly from a drill-down work item row**
