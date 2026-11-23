### 5.1. Workspace Analytics

#### 5.1.3. US-ANL-003 – Sprint & Backlog Summary KPI Cards Strip ([Author Name])

#### 5.1.3.1. Objective

Display a four-card executive KPI summary strip directly above the analytics trend charts—**Total work items**, **Completion rate**, **Avg cycle time**, and **Avg lead time**—computed server-side for the active Scope, Sprint, Work Item Type, and Date Window filters, with safe zero-division handling (`0.0%` and `N/A`), estimated-hours sub-captions, and synchronized skeleton loading states.

#### 5.1.3.2. Actors

- **Primary Actors:**
  - **Student (Team Member / Team Leader):** Monitors total scope, completion progress, and delivery speed for their assigned project or active sprint.
  - **Mentor / Teacher:** Reviews team execution health (completion percentage, cycle time, and lead time) across mentored projects.
  - **Program Manager (PM) / Class Admin:** Evaluates sprint/backlog throughput and effort completion (`doneHours / totalHours`) across managed class projects.
  - **Administrator (`ADMIN` / `SUPER_ADMIN` / `PO`):** Inspects summary KPIs across any active project within their tenant.
- **Supporting Actor:**
  - **System (`ProjectAnalyticsController`, `ProjectAnalyticsService`, `ProjectAnalyticsWorkItemRepository`, and `AnalyticsKpiCards`):** Aggregates active work items as of `windowEnd`, derives status-transition timelines from the append-only backlog audit trail, preformats KPI values with locale-independent rounding, and renders the responsive four-card KPI strip.

#### 5.1.3.3. Preconditions

- The user is authenticated and authorized to view analytics for the target project (`PROJECT_ANALYTICS_READ` permission and valid tenant/project scope per **US-ANL-001**).
- The user has opened the Project Analytics workspace (`/projects/:projectId/analytics` or `/management/workspaces/:id?tab=analytic`).
- Valid Scope, Sprint, Work Item Type, and Date Window parameters are resolved (either default scope or user-applied filters per **US-ANL-002**).

#### 5.1.3.4. Postconditions

- **Success (Scope Contains Work Items):**
  - The KPI strip renders four summary cards (`Total work items`, `Completion rate`, `Avg cycle time`, `Avg lead time`) in a responsive 2-column (mobile) / 4-column (`sm:grid-cols-4`) grid above the trend charts.
  - Every card displays its preformatted server value (using `tabular-nums`), contextual icon, explanatory tooltip (`title = kpi.hint`), primary `caption`, and—when estimated hours exist—effort `subCaption` (`doneHours / totalHours`).
  - KPI counts strictly agree with the selected scope and `as of <windowEnd>` snapshot used by the trend charts.
- **Zero Done Items or Empty Scope:**
  - No `NaN`, `Infinity`, or divide-by-zero errors ever occur; `Completion rate` renders as `0.0%` when `total = 0`, and `Avg cycle time` / `Avg lead time` render as `N/A` with caption `"No Done items in scope yet"` whenever zero Done items exist.

#### 5.1.3.5. Trigger

1. The user opens the Project Analytics workspace (initial default load).
2. The user applies or resets Scope, Sprint, Date Range, or Work Item Type filters in the **Analytics Filter Bar** (**US-ANL-002**).
3. The user retries loading after a transient network/server error.

#### 5.1.3.6. Main Flow

| Step | Actor | Action / System Response |
| --- | --- | --- |
| 1 | User | Opens the Project Analytics workspace or applies filters in the **Analytics Filter Bar**. |
| 2 | Frontend | Displays the four-card shimmer skeleton strip (`AnalyticsKpiCards` with `isLoading = true`, `role="status"`) while requesting `GET /api/v1/projects/{projectId}/analytics`. |
| 3 | Backend | Resolves the authorized user, active project, filtered `SprintBacklog` work items, effective window (`windowStart`..`windowEnd`), tenant time zone, and `completionCutoff`. |
| 4 | Backend | Evaluates each in-scope work item created on or before `windowEnd`: classifies it as `Done` (status `DONE` and `updatedOn <= windowEnd`) or `To do` (all other statuses or completed after `windowEnd`), and accumulates non-negative `estimatedHours` into `doneHours` and `totalHours`. |
| 5 | Backend | Computes `total = done + todo` and `completionRate = (total == 0) ? 0.0 : (done * 100.0 / total)`. |
| 6 | Backend | Queries `BacklogItemAuditLog` status events for Done items up to `completionCutoff` via `workItems.findStatusEvents(ids, completionCutoff)` to extract each item's earliest transition to `IN_PROGRESS` (cycle start) and earliest transition to `DONE` (completion date), falling back to `createdAt` / `updatedAt` when audit history is absent. |
| 7 | Backend | Calculates `avg-cycle-time` (mean whole days from `IN_PROGRESS` → `DONE`, clamped `>= 0`) and `avg-lead-time` (mean whole days from `createdAt` → `DONE`, clamped `>= 0`), preformats all four `ProjectAnalyticsResponse.Kpi` objects (`Locale.ROOT`, 1 decimal place), and returns HTTP `200 OK` (`Cache-Control: no-store`). |
| 8 | Frontend | Replaces the loading skeletons with the four KPI cards in `AnalyticsKpiCards`, showing icons, values, captions, optional estimated-hours sub-captions, and hover hints synchronized with the charts below. |

#### 5.1.3.7. Alternative Flows and Exceptions

**5.1.3.7.1. Scope Contains Work Items but Zero Done Items (`done = 0, todo > 0`)**

1. The backend calculates `total = todo`, `completionRate = 0.0%`, and skips the audit-trail query (`doneItems.isEmpty()`).
2. Both `avg-cycle-time` and `avg-lead-time` return `value: "N/A"` and `caption: "No Done items in scope yet"`.
3. The frontend renders all four cards cleanly (`Total work items = N`, `Completion rate = 0.0%`, `Avg cycle time = N/A`, `Avg lead time = N/A`) without division errors.

**5.1.3.7.2. Empty Filtered Scope (`total = 0`)**

1. On the backend, `kpis(...)` still safely produces valid non-`NaN` entries (`"0"`, `"0.0%"`, `"N/A"`, `"N/A"`).
2. On the frontend, `ProjectAnalyticsPage` detects `scopeIsEmpty = true` and replaces the KPI strip and chart grid with `AnalyticsEmptyState` (offering **Reset Filters** for an empty filter scope or **Go to Backlog** for an uninitialized project).

**5.1.3.7.3. Work Items Without Estimated Hours (`totalHours = 0`)**

1. If no work item in scope has positive `estimatedHours` (all `null` or `<= 0`), the backend sets `subCaption = null` on both `total-work-items` and `completion-rate`.
2. `AnalyticsKpiCards` conditionally omits the second sub-caption line rather than showing `"0.0h / 0.0h"`.

**5.1.3.7.4. Done Items Missing Status Audit History**

1. If a Done item has no `IN_PROGRESS` entry in `BacklogItemAuditLog` (e.g., moved directly from `TODO` to `DONE` or legacy migrated data), cycle time falls back to `createdAt` as the start date.
2. If a Done item has no `DONE` transition event in `BacklogItemAuditLog`, completion date falls back to the item's `updatedAt` date.
3. If an item still lacks either a valid start or completion date, it is excluded from the sample denominator (`samples`); if `samples == 0`, the average returns `N/A`.

**5.1.3.7.5. Filter Refresh & Validation Error Preservation (`422`)**

1. During filter refetch (`query.isFetching = true`), `AnalyticsKpiCards` switches to its 4-card skeleton loading layout.
2. If the newly submitted filter is rejected with HTTP `422 Unprocessable Entity`, `keepPreviousData` restores the last valid KPI strip alongside the validation alert so summary metrics never disappear.

#### 5.1.3.8. Business Rules and Notes

1. **Four Standardized KPI Cards & Formats:**

   | Key | Label | Unit | Value Format | Primary Caption | Sub-Caption |
   | --- | --- | --- | --- | --- | --- |
   | `total-work-items` | Total work items | `items` | Integer string (e.g., `"20"`) | `"{done} Done / {todo} To do"` | `"{doneHours}h / {totalHours}h"` (if `totalHours > 0`) |
   | `completion-rate` | Completion rate | `percent` | 1 decimal + `%` (e.g., `"75.0%"`, `"0.0%"`) | `"{done} of {total} items done"` | `"{doneHours}h / {totalHours}h"` (if `totalHours > 0`) |
   | `avg-cycle-time` | Avg cycle time | `days` | 1 decimal + ` days` (e.g., `"2.4 days"`) or `"N/A"` | `"{n} Done item(s) measured"` or `"No Done items in scope yet"` | `null` |
   | `avg-lead-time` | Avg lead time | `days` | 1 decimal + ` days` (e.g., `"4.8 days"`) or `"N/A"` | `"{n} Done item(s) measured"` or `"No Done items in scope yet"` | `null` |

2. **Backend-Owned Formatting (`Locale.ROOT`):** All numeric percentages, day averages, and hour totals are formatted server-side with `String.format(Locale.ROOT, "%.1f", value)` so rounding precision and decimal separators (`"."`) remain identical across the API, UI, and reports regardless of JVM or browser locale.
3. **"As Of `windowEnd`" Consistency Rule:** Items created after `windowEnd` (in the tenant time zone) are excluded from the KPI totals. An item counts toward `done` only if `status == DONE` and `updatedOn <= windowEnd`; otherwise it counts toward `todo` (covering `TODO`, `IN_PROGRESS`, `REVIEW`, `BLOCKED`, or items completed after `windowEnd`).
4. **Cycle Time vs. Lead Time Definitions:**
   - **Cycle Time:** Whole calendar days (`ChronoUnit.DAYS.between`, clamped at `>= 0`) from the item's earliest `IN_PROGRESS` audit transition (fallback: `createdAt`) to its earliest `DONE` audit transition (fallback: `updatedAt`).
   - **Lead Time:** Whole calendar days (`ChronoUnit.DAYS.between`, clamped at `>= 0`) from the item's `createdAt` date to its earliest `DONE` audit transition (fallback: `updatedAt`).
   - Audit events are fetched in ascending chronological order up to `completionCutoff`, so the first `DONE` transition is used even if an item was reopened and completed again.
5. **Estimated Hours Sanitization:** Null `estimatedHours` are treated as `0`, and negative values are clamped via `Math.max(0, estimatedHours)`.
6. **Audit Snapshot Compatibility:** `statusIn(...)` parses both structured JSON audit snapshots (`{"status": "IN_PROGRESS"}`) and legacy bare status strings (`"IN_PROGRESS"`).

### 5.1.3.9. Backend Testing Evidence on Swagger

Insert Swagger UI screenshots verifying the `kpis` array returned by the analytics endpoint for both a populated scope and an edge-case scope with zero Done items.

#### Test Case 1 – Populated Scope Returning All Four KPI Cards (`200 OK`)

- **API:** `GET /api/v1/projects/{projectId}/analytics` *(also mapped at `/api/projects/{projectId}/analytics`)*
- **Request Data:**
  - **Header:** `Authorization: Bearer <valid_jwt_token>`
  - **Path Parameter:** `projectId = 1`
  - **Query Parameters:** `scope=ALL` *(or `scope=SPRINT&sprintId=4`)*
- **Expected Result:** HTTP `200 OK` with `Cache-Control: no-store` and a `kpis` array containing four preformatted KPI objects (including estimated-hours `subCaption` when hours exist):
  ```json
  {
    "projectId": 1,
    "kpis": [
      {
        "key": "total-work-items",
        "label": "Total work items",
        "value": "20",
        "unit": "items",
        "hint": "All project work items · as of 2026-11-23 · 2026-11-02 → 2026-11-23",
        "caption": "15 Done / 5 To do",
        "subCaption": "30.0h / 40.0h"
      },
      {
        "key": "completion-rate",
        "label": "Completion rate",
        "value": "75.0%",
        "unit": "percent",
        "hint": "Done ÷ total work items in scope",
        "caption": "15 of 20 items done",
        "subCaption": "30.0h / 40.0h"
      },
      {
        "key": "avg-cycle-time",
        "label": "Avg cycle time",
        "value": "2.4 days",
        "unit": "days",
        "hint": "Mean days from the first move to In progress until Done",
        "caption": "15 Done items measured",
        "subCaption": null
      },
      {
        "key": "avg-lead-time",
        "label": "Avg lead time",
        "value": "4.8 days",
        "unit": "days",
        "hint": "Mean days from creation until Done",
        "caption": "15 Done items measured",
        "subCaption": null
      }
    ]
  }
  ```
- **Actual Result:** `[Insert HTTP status code, e.g., 200 OK, and summary of the four returned KPI cards]`

![Swagger test result for populated KPI cards strip](images/us-anl-003-swagger-kpis-populated.png)

**Figure 5.1.3-1. Swagger API test result for Sprint & Backlog Summary KPI Cards (`GET /api/v1/projects/{projectId}/analytics` – populated scope)**

---

#### Test Case 2 – Edge Case with Zero Done Items (`0.0%` & `N/A` Fallbacks)

- **API:** `GET /api/v1/projects/{projectId}/analytics`
- **Request Data:**
  - **Header:** `Authorization: Bearer <valid_jwt_token>`
  - **Path Parameter:** `projectId = 1`
  - **Query Parameters:** `scope=BACKLOG` *(or a planned sprint / itemType filter containing zero Done items)*
- **Expected Result:** HTTP `200 OK` returning `completion-rate` as `"0.0%"` and both `avg-cycle-time` and `avg-lead-time` as `"N/A"` with caption `"No Done items in scope yet"` (no `NaN` values):
  ```json
  {
    "kpis": [
      {
        "key": "total-work-items",
        "label": "Total work items",
        "value": "5",
        "unit": "items",
        "caption": "0 Done / 5 To do",
        "subCaption": "0.0h / 12.0h"
      },
      {
        "key": "completion-rate",
        "label": "Completion rate",
        "value": "0.0%",
        "unit": "percent",
        "caption": "0 of 5 items done",
        "subCaption": "0.0h / 12.0h"
      },
      {
        "key": "avg-cycle-time",
        "label": "Avg cycle time",
        "value": "N/A",
        "unit": "days",
        "caption": "No Done items in scope yet",
        "subCaption": null
      },
      {
        "key": "avg-lead-time",
        "label": "Avg lead time",
        "value": "N/A",
        "unit": "days",
        "caption": "No Done items in scope yet",
        "subCaption": null
      }
    ]
  }
  ```
- **Actual Result:** `[Insert HTTP status code, e.g., 200 OK, confirming 0.0% and N/A values]`

![Swagger test result for zero Done items KPI fallback](images/us-anl-003-swagger-kpis-zero-done.png)

**Figure 5.1.3-2. Swagger API test result for zero-Done KPI edge case (`0.0%` and `N/A` fallbacks)**

### 5.1.3.10. Frontend Screens

Insert full-screen captures of the corresponding Frontend UI screens for this Use Case.

![Sprint and Backlog Summary KPI Cards Strip populated](images/us-anl-003-ui-kpi-strip-populated.png)

**Figure 5.1.3-3. Sprint & Backlog Summary KPI Cards Strip displaying Total work items, Completion rate, Avg cycle time, Avg lead time, and estimated-hours sub-captions**

![Sprint and Backlog Summary KPI Cards Strip with N/A fallback](images/us-anl-003-ui-kpi-strip-na-state.png)

**Figure 5.1.3-4. KPI Cards Strip showing `0.0%` Completion rate and `N/A` Cycle/Lead time when no Done items exist in the selected scope**
