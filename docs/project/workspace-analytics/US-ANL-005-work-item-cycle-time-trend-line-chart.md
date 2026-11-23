### 5.1. Workspace Analytics

#### 5.1.5. US-ANL-005 – Work Item Cycle Time Trend Line Chart ([Author Name])

#### 5.1.5.1. Objective

Visualize the daily average active execution time (**Cycle Time**) of completed work items across completion dates as a single-series trend line chart with interactive node markers, enabling students, mentors, and managers to identify execution bottlenecks, evaluate delivery velocity over time, inspect exact daily averages and sample counts on hover, and drill down into the underlying completed work items for any completion date.

#### 5.1.5.2. Actors

- **Primary Actors:**
  - **Student (Team Member / Team Leader):** Monitors how long work items stay in active execution before reaching `Done` and spots process bottlenecks.
  - **Mentor / Teacher:** Evaluates team execution efficiency and investigates cycle time spikes across sprints.
  - **Program Manager (PM) / Class Admin:** Tracks active execution speed across managed class projects.
  - **Administrator (`ADMIN` / `SUPER_ADMIN` / `PO`):** Inspects cycle time trends across any active project within their tenant.
- **Supporting Actor:**
  - **System (`ProjectAnalyticsController`, `ProjectAnalyticsService`, `ProjectAnalyticsWorkItemRepository`, `WorkItemCycleTimeCard`, and `analytics-chart-ui`):** Computes fractional-day cycle times from bounded status-transition audit logs (`IN_PROGRESS` → final `DONE`), groups and averages samples by tenant-local completion date, and renders the interactive Recharts line chart.

#### 5.1.5.3. Preconditions

- The user is authenticated and authorized to view project analytics (`PROJECT_ANALYTICS_READ` permission and valid tenant/project scope per **US-ANL-001**).
- The user has opened the Project Analytics workspace (`/projects/:projectId/analytics` or `/management/workspaces/:id?tab=analytic`).
- Valid Scope, Sprint, Work Item Type, and Date Window filters are resolved (per **US-ANL-002**), and the analytics shell has loaded the chart grid.

#### 5.1.5.4. Postconditions

- **Success:**
  - The **Work item cycle time** card renders a linear blue trend line (`#2563EB`) with circular node markers across chronologically ordered completion dates (`YYYY-MM-DD`) within `[windowStart, windowEnd]`.
  - Each node plots the daily mean active execution time (`averageDays`, rounded to 1 decimal place) of all completed work items on that date, excluding open or reopened items.
  - Hovering over a node displays `MetricLineTooltip` showing the completion date, average days (1 decimal place), and completed `itemCount`.
  - Clicking a node marker (or active chart column) opens `AnalyticsDrillDownDrawer` for `{ chart: "cycle-time", date }`.
- **No Completions / Series Hidden / Error:**
  - Displays clear, non-breaking states (*"No work items completed in this window"*, *"Series hidden — click the legend item to show"*, or `WidgetInlineError` with a scoped **Retry** button).

#### 5.1.5.5. Trigger

1. The user opens the Project Analytics workspace (initial load) or clicks **Apply** / **Reset** in the **Analytics Filter Bar** (**US-ANL-002**).
2. The user interacts with the **Work item cycle time** card (hovering a node, clicking the **Avg cycle time** legend toggle button, or clicking a completion-date node marker).

#### 5.1.5.6. Main Flow

| Step | Actor | Action / System Response |
| --- | --- | --- |
| 1 | User | Opens the Project Analytics workspace or applies filters in the **Analytics Filter Bar**. |
| 2 | Frontend | Renders `ChartSkeleton` (`variant="line"`) inside the **Work item cycle time** card while requesting `GET /api/v1/projects/{projectId}/analytics`. |
| 3 | Backend | Resolves authorized scope (`doneBacklogItems` currently in status `DONE`), effective `[windowStart, windowEnd]`, tenant time zone, `completionCutoff` (`asOf`), and chronological status audit trails from `BacklogItemAuditLog`. |
| 4 | Backend | Executes `cycleTimeTrend(...)` → `cycleSample(...)` for each Done item: derives `startedAt` (first `IN_PROGRESS` transition, falling back to first transition leaving `TODO` into an active non-`DONE` state, then `createdAt`) and `completedAt` (final `DONE` transition up to `asOf`, falling back to `updatedAt`), excluding reopened or post-cutoff items. |
| 5 | Backend | Clamps `startedAt >= createdAt`, computes fractional days as `max(0, Duration.between(startedAt, completedAt).getSeconds()) / 86400.0`, converts `completedAt` to a tenant-local date (`completedOn`), filters to `[windowStart, windowEnd]`, groups into a `TreeMap` (oldest first), and calculates `averageDays` (rounded to 1 decimal place) and `itemCount` per completion date. |
| 6 | Backend | Returns HTTP `200 OK` (`Cache-Control: no-store`) with `cycleTimeTrend` (`state: "READY"`, `timeZone`, chronological `points`). |
| 7 | Frontend | Mounts `WorkItemCycleTimeCard` with a Recharts `LineChart`: X-axis labeled **Work item completed date**, Y-axis labeled **Average work item cycle time (days)** with dynamic ceiling domain `[0, Math.ceil(maxVisibleDays)]`, and a blue linear line (`#2563EB`) with white-bordered circular node markers. |
| 8 | User | Hovers over any node to view `MetricLineTooltip` (`Date`, `Avg cycle time: X.X days (N items)`), optionally toggles the **Avg cycle time** legend button, or clicks a node marker to drill down into the completed work items for that date. |

#### 5.1.5.7. Alternative Flows and Exceptions

**5.1.5.7.1. Work Item Bypassed `IN_PROGRESS` or Lacks Audit History (Start-Time Fallback)**

1. If a Done work item never recorded an `IN_PROGRESS` audit transition, `cycleSample(...)` falls back to `firstLeftTodo` (the earliest audit event where `before == TODO` and `after != DONE`, e.g., moving to `REVIEW` or `BLOCKED`).
2. If the item moved directly from `TODO` to `DONE` or has no status audit history at all, `startedAt` falls back to `item.getCreatedAt()` and `completedAt` falls back to `item.getUpdatedAt()`.
3. If either `startedAt` or `completedAt` is still `null`, the item is excluded from the sample.

**5.1.5.7.2. Open, Reopened, or Post-Window Items Excluded**

1. Work items not currently in status `DONE` are excluded prior to `cycleTimeTrend(...)` so open items never skew cycle time.
2. If a work item was moved to `DONE` and later reopened such that its `lastStatus` up to `completionCutoff` is not `DONE`, `cycleSample(...)` returns `null` (excluded).
3. If an item was reopened and subsequently re-completed on or before `completionCutoff`, `finalDone` captures the **final** `DONE` transition while retaining the **initial** active execution start (`finalDone - initialStart`).

**5.1.5.7.3. Toggling the Legend Button**

1. Clicking the **Avg cycle time** `LegendToggleButton` hides the line (`visible = false`), dims the legend button to `40%` opacity with strikethrough (`aria-pressed="false"`), resets the Y-axis domain to `[0, 1]`, and displays the centered overlay: *"Series hidden — click the legend item to show"*.
2. Clicking the legend button again restores the line and recalculates `yDomainMax`.

**5.1.5.7.4. Drilling Down on a Completion-Date Node**

1. Clicking the enlarged hover marker (`activeDot`) or clicking a column on the visible `LineChart` invokes `onDrillDown({ chart: "cycle-time", date })`, opening `AnalyticsDrillDownDrawer` (**US-ANL-008**) listing every completed work item averaged into that day's point along with its individual `cycleDays`.

**5.1.5.7.5. No Completed Work Items in Window (`state = "EMPTY"`)**

1. When no completed work items fall inside `[windowStart, windowEnd]`, the backend returns `cycleTimeTrend: { state: "EMPTY", points: [] }`.
2. When other widgets contain data, the card renders an empty line-chart frame with the centered overlay: *"No work items completed in this window"*. (When the entire scope is empty, `ProjectAnalyticsPage` displays `AnalyticsEmptyState`.)

**5.1.5.7.6. Transient Loading Failure (`500` / Network Error)**

1. If loading fails transiently, `WorkItemCycleTimeCard` displays `WidgetInlineError` inside the card (*"Unable to load analytics data right now. Please try again."*) with a scoped **Retry** button that invokes `query.refetch()`.

#### 5.1.5.8. Business Rules and Notes

1. **Active Execution Time Formula:**
   $$\text{Cycle Time (days)} = \frac{\max\bigl(0,\ \text{Duration.between}(\text{startedAt},\ \text{completedAt}).\text{getSeconds}()\bigr)}{86400}$$
   - `startedAt` resolution order: earliest transition to `IN_PROGRESS` → earliest transition out of `TODO` to a non-`DONE` active state → `createdAt`.
   - `completedAt` resolution order: final transition to `DONE` on or before `completionCutoff` → `updatedAt`.
2. **Lead Time Consistency Guardrail:** If an audit timestamp is backdated before `item.getCreatedAt()`, `startedAt` is clamped to `item.getCreatedAt()`, guaranteeing that `Cycle Time <= Lead Time` for every measured item.
3. **Completion-Date Bucketing & Rounding:** Samples are grouped by `completedAt` converted into the tenant time zone (`toTenantDate(completedAt, serverZone, tenantZone)`). Only dates within `[windowStart, windowEnd]` with at least one completed sample produce a point (no artificial zero-value points on days with zero completions). Daily averages are rounded to 1 decimal place (`Math.round(value * 10.0) / 10.0`).
4. **Exclusion of Open & Reopened Items:** Only `SprintBacklog` items in status `DONE` whose latest bounded audit status is `DONE` and whose `completedAt <= completionCutoff` contribute samples.
5. **Axis & Visual Specifications:**
   - Single linear series (`type="linear"`, `#2563EB`, `strokeWidth={2}`, `isAnimationActive={false}`), circular markers (`r=3.5` resting, `r=5.5` active with white border).
   - X-axis: `dataKey="date"`, `interval="preserveStartEnd"`, label `"Work item completed date"`.
   - Y-axis: `domain={[0, maxVisibleDays <= 0 ? 1 : Math.ceil(maxVisibleDays)]}`, label `"Average work item cycle time (days)"`.

### 5.1.5.9. Backend Testing Evidence on Swagger

Insert Swagger UI screenshots verifying the `cycleTimeTrend` payload returned by the analytics endpoint.

#### Test Case 1 – Populated Cycle Time Trend Points (`200 OK`)

- **API:** `GET /api/v1/projects/{projectId}/analytics` *(also mapped at `/api/projects/{projectId}/analytics`)*
- **Request Data:**
  - **Header:** `Authorization: Bearer <valid_jwt_token>`
  - **Path Parameter:** `projectId = 1`
  - **Query Parameters:** `scope=ALL` *(or `scope=SPRINT&sprintId=4&startDate=2026-11-01&endDate=2026-11-23`)*
- **Expected Result:** HTTP `200 OK` with header `Cache-Control: no-store` and a `cycleTimeTrend` object containing `state: "READY"`, tenant `timeZone`, and chronologically sorted `points` with 1-decimal `averageDays` and integer `itemCount`:
  ```json
  {
    "projectId": 1,
    "cycleTimeTrend": {
      "state": "READY",
      "timeZone": "Asia/Ho_Chi_Minh",
      "points": [
        { "date": "2026-11-06", "averageDays": 1.8, "itemCount": 3 },
        { "date": "2026-11-11", "averageDays": 2.4, "itemCount": 4 },
        { "date": "2026-11-15", "averageDays": 3.1, "itemCount": 2 },
        { "date": "2026-11-20", "averageDays": 2.0, "itemCount": 3 }
      ]
    }
  }
  ```
- **Actual Result:** `[Insert HTTP status code, e.g., 200 OK, verifying state="READY", tenant timeZone, and 1-decimal averageDays points]`

![Swagger test result for Work item cycle time trend payload](images/us-anl-005-swagger-cycle-time-trend.png)

**Figure 5.1.5-1. Swagger API test result for Work Item Cycle Time Trend (`GET /api/v1/projects/{projectId}/analytics` – `cycleTimeTrend` object)**

---

#### Test Case 2 – Scope With No Completed Work Items (`state = "EMPTY"`)

- **API:** `GET /api/v1/projects/{projectId}/analytics`
- **Request Data:**
  - **Header:** `Authorization: Bearer <valid_jwt_token>`
  - **Path Parameter:** `projectId = 1`
  - **Query Parameters:** `scope=BACKLOG` *(or a date window / sprint containing only open work items and zero Done items)*
- **Expected Result:** HTTP `200 OK` returning `cycleTimeTrend` with `state: "EMPTY"` and `points: []` (confirming open items are excluded):
  ```json
  {
    "projectId": 1,
    "cycleTimeTrend": {
      "state": "EMPTY",
      "timeZone": "Asia/Ho_Chi_Minh",
      "points": []
    }
  }
  ```
- **Actual Result:** `[Insert HTTP status code, e.g., 200 OK, confirming state="EMPTY" and empty points array]`

![Swagger test result for empty cycle time trend](images/us-anl-005-swagger-cycle-time-empty.png)

**Figure 5.1.5-2. Swagger API test result when no completed items exist in scope (`cycleTimeTrend.state = "EMPTY"`)**

### 5.1.5.10. Frontend Screens

Insert full-screen captures of the corresponding Frontend UI screens for this Use Case.

![Work item cycle time trend line chart with hover tooltip](images/us-anl-005-ui-cycle-time-tooltip.png)

**Figure 5.1.5-3. Work Item Cycle Time Trend line chart with circular node markers and hover tooltip showing average days and completed item count**

![Work item cycle time empty state overlay](images/us-anl-005-ui-cycle-time-empty.png)

**Figure 5.1.5-4. Work Item Cycle Time card displaying empty/hidden state handling when no completions exist in the selected window**
