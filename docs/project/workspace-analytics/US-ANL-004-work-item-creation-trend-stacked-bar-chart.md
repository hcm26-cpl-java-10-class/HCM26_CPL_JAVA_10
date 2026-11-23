### 5.1. Workspace Analytics

#### 5.1.4. US-ANL-004 – Work Item Creation Trend Stacked Bar Chart (Done vs. To Do) ([Author Name])

#### 5.1.4.1. Objective

Visualize daily work item creation volume within the selected project scope and date window as a stacked bar chart (`Done` bottom segment vs. `To Do` top segment), enabling team members, mentors, and managers to evaluate intake trends, distinguish completed vs. still-open created work items, inspect exact counts and percentage shares on hover, toggle series with automatic Y-axis rescaling, and drill down into underlying work items per bar segment.

#### 5.1.4.2. Actors

- **Primary Actors:**
  - **Student (Team Member / Team Leader):** Tracks how many work items were created each day and how many remain open versus completed.
  - **Mentor / Teacher:** Monitors scope creep (mid-sprint creation spikes) and completion burn-off across creation cohorts.
  - **Program Manager (PM) / Class Admin:** Reviews intake volume and execution balance across managed class projects.
  - **Administrator (`ADMIN` / `SUPER_ADMIN` / `PO`):** Inspects creation trend analytics across any active project within their tenant.
- **Supporting Actor:**
  - **System (`ProjectAnalyticsController`, `ProjectAnalyticsService`, `ProjectAnalyticsWorkItemRepository`, `WorkItemCreationTrendCard`, and `analytics-chart-ui`):** Groups in-scope work items and subtasks by creation date in the tenant time zone, splits each date bucket into mutually exclusive `done` and `todo` counts using bounded status audit history, and renders the interactive Recharts stacked bar chart.

#### 5.1.4.3. Preconditions

- The user is authenticated and authorized to view project analytics (`PROJECT_ANALYTICS_READ` permission and valid tenant/project scope per **US-ANL-001**).
- The user has opened the Project Analytics workspace (`/projects/:projectId/analytics` or `/management/workspaces/:id?tab=analytic`).
- Valid Scope, Sprint, Work Item Type, and Date Window filters are resolved (per **US-ANL-002**), and at least one work item exists in the resolved scope so the chart grid is rendered.

#### 5.1.4.4. Postconditions

- **Success:**
  - The **Work item creation trend** card renders in the 2-column analytics chart grid displaying one vertical stacked bar per creation date (oldest first) within `[windowStart, windowEnd]`.
  - Each bar stacks **`Done`** (`#2563EB` blue, bottom) and **`To Do`** (`#7CB342` green, top) so `done + todo` equals the total items created on that date.
  - Hovering over a bar displays the floating `StackedBarTooltip` with exact `Done` / `To Do` counts, percentage shares (1 decimal place), and stacked `Total`.
  - Clicking a legend button toggles that series on/off and rescales the Y-axis; clicking a bar segment opens the drill-down drawer for `{ chart: "creation", date, series }`.
- **No Data / All Series Hidden / Error:**
  - Displays clear, non-breaking overlay messages (*"No items created in this window"* or *"All series hidden — click a legend item to show"*) or an inline `WidgetInlineError` with a **Retry** button.

#### 5.1.4.5. Trigger

1. The user opens the Project Analytics workspace (initial load) or clicks **Apply** / **Reset** in the **Analytics Filter Bar** (**US-ANL-002**).
2. The user interacts directly with the **Work item creation trend** card (hovering a stacked bar, toggling the `Done` / `To Do` legend buttons, or clicking a bar segment).

#### 5.1.4.6. Main Flow

| Step | Actor | Action / System Response |
| --- | --- | --- |
| 1 | User | Opens the Project Analytics workspace or applies filters in the **Analytics Filter Bar**. |
| 2 | Frontend | Renders `ChartSkeleton` (`variant="bar"`) inside the **Work item creation trend** card while requesting `GET /api/v1/projects/{projectId}/analytics`. |
| 3 | Backend | Resolves authorized scope (`SprintBacklog` items plus linked active `ProjectTask` subtasks when `itemType = ALL`), effective `[windowStart, windowEnd]`, tenant time zone, and `completionCutoff`. |
| 4 | Backend | Executes `creationTrend(...)`: iterates through each in-scope backlog item and subtask, converts its `createdAt` timestamp to a tenant-local date (`createdOn`), and skips items created outside `[windowStart, windowEnd]`. |
| 5 | Backend | For each retained item, determines completion via `backlogCompletedOn(...)` / `subtaskCompletedOn(...)` against status audit events up to `completionCutoff`. Increments `done` if completed on or before `windowEnd` (and not reopened); otherwise increments `todo`. |
| 6 | Backend | Serializes the sorted `TreeMap` into `creationTrend` (`state: "READY"`, `timeZone`, `series: [done, todo]`, chronologically ordered `buckets`) and returns HTTP `200 OK` (`Cache-Control: no-store`). |
| 7 | Frontend | Mounts `WorkItemCreationTrendCard` with a Recharts `BarChart` (`stackId="creation"`): X-axis labeled **Work item creation date** (`YYYY-MM-DD`), integer Y-axis labeled **Count of work items**, blue **Done** base bars (`#2563EB`), and green **To Do** stacked top bars (`#7CB342`). |
| 8 | User | Hovers over a stacked bar to view `StackedBarTooltip` (`Date`, `Done: count (share%)`, `To Do: count (share%)`, `Total`), optionally clicks legend buttons (`Done` / `To Do`) to toggle series and rescale the Y-axis, or clicks a bar segment to inspect its underlying work items. |

#### 5.1.4.7. Alternative Flows and Exceptions

**5.1.4.7.1. Toggling Series Visibility via Legend Buttons**

1. The user clicks the **Done** or **To Do** `LegendToggleButton` in the card header.
2. The toggled series hides from the bar stack, its legend button dims to `40%` opacity with strikethrough (`aria-pressed="false"`), and if `To Do` is hidden while `Done` remains visible, the `Done` bar adopts rounded top corners (`[4, 4, 0, 0]`).
3. `yDomainMax` recalculates dynamically to the maximum stacked total of the remaining visible series (`maxVisibleTotal <= 0 ? 1 : maxVisibleTotal`).
4. If the user hides **both** `Done` and `To Do`, the card displays a centered overlay message: *"All series hidden — click a legend item to show"*.

**5.1.4.7.2. Drilling Down into a Bar Segment**

1. The user clicks a `Done` or `To Do` segment of any date bar.
2. `WorkItemCreationTrendCard` invokes `onDrillDown({ chart: "creation", date, series })`, opening `AnalyticsDrillDownDrawer` (**US-ANL-008**) to list the exact work items created on `date` belonging to the clicked `done` or `todo` cohort.

**5.1.4.7.3. No Items Created in the Selected Window (`state = "EMPTY"`)**

1. If no in-scope work item or subtask has a `createdOn` date inside `[windowStart, windowEnd]`, the backend returns `creationTrend: { state: "EMPTY", buckets: [] }`.
2. When other widgets have data (so the chart grid remains visible), the card renders an empty chart frame with the centered overlay: *"No items created in this window"*. (When the entire scope is empty, `ProjectAnalyticsPage` renders `AnalyticsEmptyState`.)

**5.1.4.7.4. Reopened Work Items or Items Completed After `windowEnd`**

1. If a work item was moved to `DONE` and later reopened (last audit status up to `completionCutoff` is not `DONE`, or current status is not `DONE`), `backlogCompletedOn` / `subtaskCompletedOn` returns `null`, placing the item into the **`To Do`** segment rather than `Done`.
2. Similarly, if an item was created inside the window but completed after `windowEnd`, it counts in **`To Do`** for that historical window snapshot.

**5.1.4.7.5. Transient Loading Failure (`500` / Network Error)**

1. If the analytics query fails transiently, `WorkItemCreationTrendCard` renders `WidgetInlineError` inside the card body (*"Unable to load analytics data right now. Please try again."*) with a scoped **Retry** button that triggers `query.refetch()`.

#### 5.1.4.8. Business Rules and Notes

1. **Creation-Date Grouping (Trend, Not Full Calendar):** Only dates inside `[windowStart, windowEnd]` (inclusive, derived in the tenant time zone) that actually had at least one work item or subtask created produce a bucket; days with zero creations are omitted. Buckets are sorted chronologically (oldest first) via `TreeMap`.
2. **Mutually Exclusive Binary Split (`Done` vs. `To Do`):**
   - **`done` (Blue `#2563EB`, bottom segment):** In-scope items created on `date` that are currently `DONE`, whose latest audit status up to `completionCutoff` is `DONE` (excluding reopened items), and whose completion date is `<= windowEnd`.
   - **`todo` (Green `#7CB342`, top segment):** All other in-scope items created on `date` (`TODO`, `IN_PROGRESS`, `REVIEW`, `BLOCKED`, reopened items, or items completed after `windowEnd`).
   - An item is never counted in both segments, guaranteeing `done + todo = daily created count`.
3. **Subtask Inclusion & Reconciliation with Completion Trend (`US-ANL-007`):** When `itemType = ALL`, both `SprintBacklog` items and their active child `ProjectTask` subtasks are included in `creationTrend` using the identical `completionCutoff` and reopened-item rule as `completionTrend`. With no date restriction, the total `done` sum across all bars in `creationTrend` reconciles exactly with the total completed items across all bars in `completionTrend`.
4. **Axis & Visual Specifications:**
   - X-axis: `dataKey="date"`, `interval="preserveStartEnd"`, label `"Work item creation date"`.
   - Y-axis: whole integers only (`allowDecimals={false}`), label `"Count of work items"`, dynamic upper bound `Math.max(1, maxVisibleTotal)`.
   - Bar geometry: `stackId="creation"`, `barCategoryGap="24%"`, `maxBarSize={36}`, top visible segment rounded `[4, 4, 0, 0]`.
5. **Tooltip Calculation:** `StackedBarTooltip` computes each visible series' percentage share dynamically against the **visible** stacked total (`(value / visibleTotal) * 100`, rounded to 1 decimal place, or `0.0%` when `visibleTotal === 0`).

### 5.1.4.9. Backend Testing Evidence on Swagger

Insert Swagger UI screenshots verifying the `creationTrend` payload returned by the analytics endpoint.

#### Test Case 1 – Populated Creation Trend Stacked Buckets (`200 OK`)

- **API:** `GET /api/v1/projects/{projectId}/analytics` *(also mapped at `/api/projects/{projectId}/analytics`)*
- **Request Data:**
  - **Header:** `Authorization: Bearer <valid_jwt_token>`
  - **Path Parameter:** `projectId = 1`
  - **Query Parameters:** `scope=ALL` *(or `scope=SPRINT&sprintId=4&startDate=2026-11-01&endDate=2026-11-23`)*
- **Expected Result:** HTTP `200 OK` with header `Cache-Control: no-store` and a `creationTrend` object containing `state: "READY"`, tenant `timeZone`, ordered `series` (`done` then `todo`), and chronologically sorted `buckets` where each bucket represents a creation date with non-negative `done` and `todo` counts:
  ```json
  {
    "projectId": 1,
    "creationTrend": {
      "state": "READY",
      "timeZone": "Asia/Ho_Chi_Minh",
      "series": [
        { "key": "done", "label": "Done" },
        { "key": "todo", "label": "To Do" }
      ],
      "buckets": [
        { "date": "2026-11-03", "done": 6, "todo": 2 },
        { "date": "2026-11-07", "done": 4, "todo": 3 },
        { "date": "2026-11-12", "done": 3, "todo": 5 },
        { "date": "2026-11-18", "done": 2, "todo": 4 }
      ]
    }
  }
  ```
- **Actual Result:** `[Insert HTTP status code, e.g., 200 OK, verifying state="READY", series order [done, todo], and chronological buckets]`

![Swagger test result for Work item creation trend payload](images/us-anl-004-swagger-creation-trend.png)

**Figure 5.1.4-1. Swagger API test result for Work Item Creation Trend (`GET /api/v1/projects/{projectId}/analytics` – `creationTrend` object)**

---

#### Test Case 2 – Empty Creation Window (`state = "EMPTY"`)

- **API:** `GET /api/v1/projects/{projectId}/analytics`
- **Request Data:**
  - **Header:** `Authorization: Bearer <valid_jwt_token>`
  - **Path Parameter:** `projectId = 1`
  - **Query Parameters:** `scope=ALL&startDate=2025-01-01&endDate=2025-01-07` *(a valid date range containing zero created work items)*
- **Expected Result:** HTTP `200 OK` returning `creationTrend` with `state: "EMPTY"` and `buckets: []`:
  ```json
  {
    "projectId": 1,
    "creationTrend": {
      "state": "EMPTY",
      "timeZone": "Asia/Ho_Chi_Minh",
      "series": [
        { "key": "done", "label": "Done" },
        { "key": "todo", "label": "To Do" }
      ],
      "buckets": []
    }
  }
  ```
- **Actual Result:** `[Insert HTTP status code, e.g., 200 OK, confirming state="EMPTY" and empty buckets array]`

![Swagger test result for empty creation trend window](images/us-anl-004-swagger-creation-trend-empty.png)

**Figure 5.1.4-2. Swagger API test result for an empty creation window (`creationTrend.state = "EMPTY"`)**

### 5.1.4.10. Frontend Screens

Insert full-screen captures of the corresponding Frontend UI screens for this Use Case.

![Work item creation trend stacked bar chart with tooltip](images/us-anl-004-ui-creation-trend-tooltip.png)

**Figure 5.1.4-3. Work Item Creation Trend stacked bar chart (`Done` blue base vs. `To Do` green cap) with interactive hover tooltip showing counts, percentage shares, and total**

![Work item creation trend legend toggled with rescaled Y-axis](images/us-anl-004-ui-creation-trend-legend-toggle.png)

**Figure 5.1.4-4. Legend toggle interaction dimming a hidden series and automatically rescaling the Y-axis**
