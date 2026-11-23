### 5.1. Workspace Analytics

#### 5.1.7. US-ANL-007 – Work Item Completion Trend Stacked Bar Chart ([Author Name])

#### 5.1.7.1. Objective

Visualize daily work item completion throughput within the selected scope and date window as a stacked bar chart broken down by work item type (**Subtask**, **Story**, and conditionally **Task**), reconciling completed totals with the Creation Trend chart (**US-ANL-004**), excluding reopened or unfinished work items, supporting interactive legend toggling with dynamic Y-axis rescaling, and enabling click-to-drill-down per stacked segment.

#### 5.1.7.2. Actors

- **Primary Actors:**
  - **Student (Team Member / Team Leader):** Tracks daily team completion throughput and sees whether Stories, Subtasks, or Tasks are closing steadily throughout the sprint.
  - **Mentor / Teacher:** Evaluates delivery cadence (steady daily closure vs. end-of-sprint crunch) and completion composition by work item type.
  - **Program Manager (PM) / Class Admin:** Reviews completion volume across managed class projects and sprints.
  - **Administrator (`ADMIN` / `SUPER_ADMIN` / `PO`):** Inspects completion trends across any active project within their tenant.
- **Supporting Actor:**
  - **System (`ProjectAnalyticsController`, `ProjectAnalyticsService`, `ProjectAnalyticsWorkItemRepository`, `WorkItemCompletionTrendCard`, and `analytics-chart-ui`):** Groups genuinely completed `SprintBacklog` items and linked `ProjectTask` subtasks by tenant-local completion date using bounded audit trails, conditionally emits the `task` series, and renders the interactive Recharts stacked bar chart.

#### 5.1.7.3. Preconditions

- The user is authenticated and authorized to view project analytics (`PROJECT_ANALYTICS_READ` permission and valid tenant/project scope per **US-ANL-001**).
- The user has opened the Project Analytics workspace (`/projects/:projectId/analytics` or `/management/workspaces/:id?tab=analytic`).
- Valid Scope, Sprint, Work Item Type, and Date Window filters are resolved (per **US-ANL-002**), and the analytics shell has loaded the chart grid.

#### 5.1.7.4. Postconditions

- **Success:**
  - The **Work item completion trend** card renders vertical stacked bars per completion date (`YYYY-MM-DD`, oldest first) within `[windowStart, windowEnd]`.
  - Each bar stacks **Subtask** (`#2563EB` blue, bottom), **Story** (`#7CB342` green, middle), and—when non-Story backlog tasks exist—**Task** (`#A855F7` purple, top), with rounded top corners applied dynamically to the topmost visible segment.
  - With no date restriction applied, the sum of all stacked bar segments across `completionTrend` reconciles exactly with the total `Done` count in `creationTrend` (**US-ANL-004**).
  - Hovering over a bar displays `StackedBarTooltip` with exact counts, percentage shares (1 decimal place), and stacked `Total`; clicking a segment opens `AnalyticsDrillDownDrawer` for `{ chart: "completion", date, series }`.
- **No Completions / All Series Hidden / Error:**
  - Displays clear, non-breaking states (*"No work items completed in this window"*, *"All series hidden — click a legend item to show"*, or `WidgetInlineError` with a scoped **Retry** button).

#### 5.1.7.5. Trigger

1. The user opens the Project Analytics workspace (initial load) or clicks **Apply** / **Reset** in the **Analytics Filter Bar** (**US-ANL-002**).
2. The user interacts with the **Work item completion trend** card (hovering a bar, toggling the **Subtask** / **Story** / **Task** legend buttons, or clicking a stacked bar segment).

#### 5.1.7.6. Main Flow

| Step | Actor | Action / System Response |
| --- | --- | --- |
| 1 | User | Opens the Project Analytics workspace or applies filters in the **Analytics Filter Bar**. |
| 2 | Frontend | Renders `ChartSkeleton` (`variant="bar"`) inside the **Work item completion trend** card while requesting `GET /api/v1/projects/{projectId}/analytics`. |
| 3 | Backend | Resolves authorized scope (`doneBacklogItems` currently in `DONE`, and—when `itemType = ALL`—linked active `doneSubtasks` currently in `DONE`), effective `[windowStart, windowEnd]`, tenant time zone, `completionCutoff` (`asOf`), and chronological status audit logs. |
| 4 | Backend | Executes `completionTrend(...)`: determines each item's completion date via `backlogCompletedOn(...)` and `subtaskCompletedOn(...)`, skipping items that are reopened (latest bounded audit status != `DONE`) or completed outside `[windowStart, windowEnd]`. |
| 5 | Backend | Accumulates counts per completion date into a sorted `TreeMap<LocalDate, CompletionAccumulator>` (oldest first): increments `story` for `SprintBacklogWorkType.STORY`, increments `task` (and marks `hasTasks = true`) for other completed backlog items, and increments `subtask` for completed `ProjectTask` subtasks. |
| 6 | Backend | Builds the `series` list (`[subtask, story, task]` if `hasTasks`, else `[subtask, story]`) and returns HTTP `200 OK` (`Cache-Control: no-store`) with `completionTrend` (`state: "READY"`, `timeZone`, `series`, `buckets`). |
| 7 | Frontend | Mounts `WorkItemCompletionTrendCard` with a Recharts `BarChart` (`stackId="completion"`): X-axis labeled **Work item completed date**, integer Y-axis labeled **Count of work items**, blue **Subtask** base, green **Story** segment, and conditional purple **Task** cap. |
| 8 | User | Hovers over a stacked bar to inspect `StackedBarTooltip` (`Date`, per-type counts & percentage shares, `Total`), optionally toggles legend buttons to filter series with automatic Y-axis rescaling, or clicks a stacked segment to drill down into the completed items. |

#### 5.1.7.7. Alternative Flows and Exceptions

**5.1.7.7.1. Conditional Display of the `Task` Series (`hasTasks = false`)**

1. When no completed non-Story backlog items (`TASK` / `BUG`) exist in the resolved scope, the backend sets `hasTasks = false` and omits `task` from `completionTrend.series` (returning only `subtask` and `story`).
2. `WorkItemCompletionTrendCard` checks `hasTasks = rows.some(r => r.task > 0) || trend?.series?.some(s => s.key === "task")`; when false, both the **Task** legend toggle button and the purple **Task** bar stack are omitted, and the **Story** segment receives the rounded top corners (`[4, 4, 0, 0]`).

**5.1.7.7.2. Reopened Items Excluded Until Re-Completed**

1. If a work item or subtask was previously marked `DONE` and later moved back to an open status (`TODO`, `IN_PROGRESS`, `REVIEW`, `BLOCKED`), either its current status is not `DONE` or its last audit event up to `completionCutoff` is not `DONE`.
2. `backlogCompletedOn(...)` / `subtaskCompletedOn(...)` returns `null`, excluding the reopened item from `completionTrend` until it transitions back to `DONE`.

**5.1.7.7.3. Toggling Legend Buttons & Dynamic Top-Segment Rounding**

1. Clicking the **Subtask**, **Story**, or **Task** `LegendToggleButton` hides that series, dims its legend button to `40%` opacity with strikethrough (`aria-pressed="false"`), recalculates `yDomainMax` from the remaining visible stacked totals (`maxVisibleTotal <= 0 ? 1 : maxVisibleTotal`), and dynamically moves the `[4, 4, 0, 0]` top-corner radius to `topVisibleKey`.
2. If all available series are hidden (`allHidden = true`), the card displays the centered overlay: *"All series hidden — click a legend item to show"*.

**5.1.7.7.4. Drilling Down into a Completed Segment**

1. Clicking a `Subtask`, `Story`, or `Task` bar segment invokes `handleBarClick(series, barData)` → `onDrillDown({ chart: "completion", date, series })`, opening `AnalyticsDrillDownDrawer` (**US-ANL-008**) pre-filtered to the clicked work item type completed on `date`.

**5.1.7.7.5. No Work Items Completed in Window (`state = "EMPTY"`)**

1. When no in-scope work item or subtask completed within `[windowStart, windowEnd]`, the backend returns `completionTrend: { state: "EMPTY", buckets: [] }`.
2. When other widgets have data, the card displays the centered overlay: *"No work items completed in this window"*. (When the entire scope is empty, `ProjectAnalyticsPage` displays `AnalyticsEmptyState`.)

**5.1.7.7.6. Transient Loading Failure (`500` / Network Error)**

1. If loading fails transiently, `WorkItemCompletionTrendCard` renders `WidgetInlineError` (*"Unable to load analytics data right now. Please try again."*) with a scoped **Retry** button invoking `query.refetch()`.

#### 5.1.7.8. Business Rules and Notes

1. **Work Item Type Stacking & Color Palette:**

   | Stack Position | Series Key | Legend Label | Data Source | Fill Color | Condition |
   | --- | --- | --- | --- | --- | --- |
   | Bottom | `subtask` | Subtask | Completed `ProjectTask` subtasks (when `itemType = ALL`) | `#2563EB` (Blue) | Always in legend |
   | Middle | `story` | Story | Completed `SprintBacklog` items (`workType = STORY`) | `#7CB342` (Green) | Always in legend |
   | Top | `task` | Task | Completed non-Story `SprintBacklog` items (`TASK`, `BUG`, or default) | `#A855F7` (Purple) | Shown only when `hasTasks = true` |

2. **Reconciliation with Work Item Creation Trend (`US-ANL-004`):** Both `completionTrend` and `creationTrend` share the identical `backlogCompletedOn` / `subtaskCompletedOn` helpers, tenant time zone conversion, `completionCutoff`, and reopened-item exclusion rule. Without a restricting date window, the sum of all bars in `completionTrend` equals the sum of all `done` segments in `creationTrend`.
3. **Completion-Date Grouping (Trend Only):** Only dates inside `[windowStart, windowEnd]` with at least one completed item produce a bucket (no zero-height bars for inactive dates), ordered chronologically oldest first via `TreeMap`.
4. **Reopened & Post-Cutoff Guardrails:** Only items currently in status `DONE` whose latest bounded status audit transition up to `completionCutoff` is `DONE` and whose completion timestamp is `<= completionCutoff` are counted.
5. **Axis & Visual Specifications:**
   - X-axis: `dataKey="date"`, `interval="preserveStartEnd"`, label `"Work item completed date"`.
   - Y-axis: whole integers (`allowDecimals={false}`), label `"Count of work items"`, dynamic domain `[0, Math.max(1, maxVisibleTotal)]`.
   - Bar geometry: `stackId="completion"`, `barCategoryGap="24%"`, `maxBarSize={36}`, top visible segment rounded `[4, 4, 0, 0]`.

### 5.1.7.9. Backend Testing Evidence on Swagger

Insert Swagger UI screenshots verifying the `completionTrend` payload returned by the analytics endpoint.

#### Test Case 1 – Populated Completion Trend Stacked Buckets (`200 OK`)

- **API:** `GET /api/v1/projects/{projectId}/analytics` *(also mapped at `/api/projects/{projectId}/analytics`)*
- **Request Data:**
  - **Header:** `Authorization: Bearer <valid_jwt_token>`
  - **Path Parameter:** `projectId = 1`
  - **Query Parameters:** `scope=ALL` *(or `scope=SPRINT&sprintId=4` with `itemType=ALL`)*
- **Expected Result:** HTTP `200 OK` with header `Cache-Control: no-store` and a `completionTrend` object containing `state: "READY"`, tenant `timeZone`, ordered `series` (`subtask`, `story`, plus `task` when Task/Bug items exist), and chronologically sorted `buckets` whose total reconciles with `creationTrend`'s `done` total when unfiltered by date:
  ```json
  {
    "projectId": 1,
    "completionTrend": {
      "state": "READY",
      "timeZone": "Asia/Ho_Chi_Minh",
      "series": [
        { "key": "subtask", "label": "Subtask" },
        { "key": "story", "label": "Story" },
        { "key": "task", "label": "Task" }
      ],
      "buckets": [
        { "date": "2026-11-06", "subtask": 3, "story": 2, "task": 1 },
        { "date": "2026-11-12", "subtask": 4, "story": 1, "task": 2 },
        { "date": "2026-11-18", "subtask": 2, "story": 3, "task": 0 }
      ]
    }
  }
  ```
- **Actual Result:** `[Insert HTTP status code, e.g., 200 OK, verifying state="READY", series breakdown, chronological buckets, and reconciliation with creationTrend Done total]`

![Swagger test result for Work item completion trend payload](images/us-anl-007-swagger-completion-trend.png)

**Figure 5.1.7-1. Swagger API test result for Work Item Completion Trend (`GET /api/v1/projects/{projectId}/analytics` – `completionTrend` object)**

---

#### Test Case 2 – Scope With Zero Completed Work Items (`state = "EMPTY"`)

- **API:** `GET /api/v1/projects/{projectId}/analytics`
- **Request Data:**
  - **Header:** `Authorization: Bearer <valid_jwt_token>`
  - **Path Parameter:** `projectId = 1`
  - **Query Parameters:** `scope=BACKLOG` *(or a date range containing zero completed work items)*
- **Expected Result:** HTTP `200 OK` returning `completionTrend` with `state: "EMPTY"`, default `series` (`subtask`, `story`), and `buckets: []`:
  ```json
  {
    "projectId": 1,
    "completionTrend": {
      "state": "EMPTY",
      "timeZone": "Asia/Ho_Chi_Minh",
      "series": [
        { "key": "subtask", "label": "Subtask" },
        { "key": "story", "label": "Story" }
      ],
      "buckets": []
    }
  }
  ```
- **Actual Result:** `[Insert HTTP status code, e.g., 200 OK, confirming state="EMPTY" and empty buckets array]`

![Swagger test result for empty completion trend](images/us-anl-007-swagger-completion-trend-empty.png)

**Figure 5.1.7-2. Swagger API test result when no completed items exist in scope (`completionTrend.state = "EMPTY"`)**

### 5.1.7.10. Frontend Screens

Insert full-screen captures of the corresponding Frontend UI screens for this Use Case.

![Work item completion trend stacked bar chart with tooltip](images/us-anl-007-ui-completion-trend-tooltip.png)

**Figure 5.1.7-3. Work Item Completion Trend stacked bar chart (`Subtask` blue, `Story` green, `Task` purple) with interactive hover tooltip showing per-type counts, percentage shares, and daily total**

![Work item completion trend legend toggled with rescaled Y-axis](images/us-anl-007-ui-completion-trend-legend-toggle.png)

**Figure 5.1.7-4. Legend toggle interaction dimming hidden series, dynamically rounding the top visible segment, and rescaling the Y-axis**
