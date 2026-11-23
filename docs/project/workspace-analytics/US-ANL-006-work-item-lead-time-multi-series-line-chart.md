### 5.1. Workspace Analytics

#### 5.1.6. US-ANL-006 – Work Item Lead Time Multi-Series Line Chart (Story / Subtask / Task) ([Author Name])

#### 5.1.6.1. Objective

Visualize and compare daily average end-to-end **Lead Time** (from item creation until final completion) across **Story**, **Subtask**, and **Task** work item types in a multi-series line chart, preserving clean visual gaps on sparse dates (`null`, never false zeros), supporting per-series legend toggling with dynamic Y-axis rescaling, and enabling click-to-drill-down inspection of completed items by date and work item type.

#### 5.1.6.2. Actors

- **Primary Actors:**
  - **Student (Team Member / Team Leader):** Compares end-to-end delivery latency between Stories, Subtasks, and Tasks to identify queue wait time versus execution duration.
  - **Mentor / Teacher:** Evaluates whether large Stories or unrefined Tasks are sitting too long in the backlog before completion compared to Subtasks.
  - **Program Manager (PM) / Class Admin:** Tracks end-to-end delivery lead times across work item granularities for managed class projects.
  - **Administrator (`ADMIN` / `SUPER_ADMIN` / `PO`):** Inspects multi-series lead time trends across any active project within their tenant.
- **Supporting Actor:**
  - **System (`ProjectAnalyticsController`, `ProjectAnalyticsService`, `ProjectAnalyticsWorkItemRepository`, `WorkItemLeadTimeCard`, and `analytics-chart-ui`):** Aggregates completed `SprintBacklog` (Story/Task) and `ProjectTask` (Subtask) lead times from creation and bounded status-transition audit trails, emits sparse `null`-safe multi-series points, and renders the interactive Recharts multi-series line chart.

#### 5.1.6.3. Preconditions

- The user is authenticated and authorized to view project analytics (`PROJECT_ANALYTICS_READ` permission and valid tenant/project scope per **US-ANL-001**).
- The user has opened the Project Analytics workspace (`/projects/:projectId/analytics` or `/management/workspaces/:id?tab=analytic`).
- Valid Scope, Sprint, Work Item Type, and Date Window filters are resolved (per **US-ANL-002**), and the analytics shell has loaded the chart grid.

#### 5.1.6.4. Postconditions

- **Success:**
  - The **Work item lead time** card renders up to three color-coded linear series—**Story** (`#2563EB` blue), **Subtask** (`#7CB342` green), and **Task** (`#A855F7` purple)—across chronologically ordered completion dates (`YYYY-MM-DD`) within `[windowStart, windowEnd]`.
  - Dates with zero completions for a specific type return `null` and render with `connectNulls={false}` so no misleading zero points or bridged segments appear.
  - Hovering over a date displays `MetricLineTooltip` listing only visible non-null series with their exact 1-decimal average days and completed item counts (`storyCount`, `subtaskCount`, `taskCount`).
  - Toggling any legend series dynamically rescales the Y-axis; clicking a node marker drills down into that specific date and work item type (`{ chart: "lead-time", date, series }`).
- **No Completions / All Series Hidden / Error:**
  - Displays clear, non-breaking states (*"No work items completed in this window"*, *"All series hidden — click a legend item to show"*, or `WidgetInlineError` with a scoped **Retry** button).

#### 5.1.6.5. Trigger

1. The user opens the Project Analytics workspace (initial load) or clicks **Apply** / **Reset** in the **Analytics Filter Bar** (**US-ANL-002**).
2. The user interacts with the **Work item lead time** card (hovering a node, clicking the **Story** / **Subtask** / **Task** legend toggle buttons, or clicking a node marker / date column).

#### 5.1.6.6. Main Flow

| Step | Actor | Action / System Response |
| --- | --- | --- |
| 1 | User | Opens the Project Analytics workspace or applies filters in the **Analytics Filter Bar**. |
| 2 | Frontend | Renders `ChartSkeleton` (`variant="line"`) inside the **Work item lead time** card while requesting `GET /api/v1/projects/{projectId}/analytics`. |
| 3 | Backend | Resolves authorized scope (`doneBacklogItems` in status `DONE` and—when `itemType = ALL`—linked active `doneSubtasks` in status `DONE`), effective `[windowStart, windowEnd]`, tenant time zone, `completionCutoff` (`asOf`), and chronological `BacklogItemAuditLog` / `TaskAuditLog` status trails. |
| 4 | Backend | Executes `leadTimeTrend(...)`: classifies Done backlog items into `STORY` or `TASK` (defaulting `null` workType to `SprintBacklogWorkType.DEFAULT`; skipping `BUG`) via `backlogLeadSample(...)`, and processes Done subtasks via `subtaskLeadSample(...)`. |
| 5 | Backend | For each valid completed item, resolves `completedAt` (final `DONE` transition up to `asOf`, falling back to `updatedAt`, excluding reopened/post-cutoff items), computes fractional lead days as `max(0, Duration.between(createdAt, completedAt).getSeconds()) / 86400.0`, converts `completedAt` to a tenant-local date (`completedOn`), and filters to `[windowStart, windowEnd]`. |
| 6 | Backend | Groups samples into a sorted `TreeMap<LocalDate, LeadAccumulator>` (oldest first), rounds each non-empty type's daily mean to 1 decimal place (`null` when count is 0), and returns HTTP `200 OK` (`Cache-Control: no-store`) with `leadTimeTrend` (`state: "READY"`, `timeZone`, `series`, `points`). |
| 7 | Frontend | Mounts `WorkItemLeadTimeCard` with a Recharts `LineChart` (`connectNulls={false}`): X-axis labeled **Work item completed date**, Y-axis labeled **Average work item lead time (days)** with dynamic ceiling domain `[0, Math.ceil(maxVisibleDays)]`, and distinct Story (blue), Subtask (green), and Task (purple) lines with circular markers. |
| 8 | User | Hovers over a completion date to compare visible series in `MetricLineTooltip`, toggles **Story** / **Subtask** / **Task** legend buttons to isolate specific types with automatic Y-axis rescaling, or clicks a node marker to inspect underlying work items. |

#### 5.1.6.7. Alternative Flows and Exceptions

**5.1.6.7.1. Sparse Completion Dates (Zero Completions for One or Two Series)**

1. If a completion date has completed `Story` and `Subtask` items but zero completed `Task` items, the backend returns `"task": null, "taskCount": 0` for that date.
2. Because `Line` is configured with `connectNulls={false}`, the `Task` line renders a clean gap rather than plotting `0.0` or falsely bridging across missing dates, and `MetricLineTooltip` omits `null` series from the hover card.

**5.1.6.7.2. Filtering by a Specific Work Item Type (`itemType = STORY | TASK | BUG`)**

1. When a specific `itemType` filter is applied in **US-ANL-002**, `ProjectAnalyticsService` skips loading `ProjectTask` subtasks (`subtasks = List.of()`), so the `subtask` series contains `null` values.
2. If `itemType = STORY`, only the `Story` series populates; if `itemType = TASK`, only the `Task` series populates; if `itemType = BUG`, `leadTimeTrend` returns `state: "EMPTY"` and `points: []` because the multi-series chart compares `Story`, `Subtask`, and `Task`.

**5.1.6.7.3. Toggling Multi-Series Legend Buttons & Y-Axis Rescaling**

1. Clicking any of the **Story**, **Subtask**, or **Task** `LegendToggleButton` controls hides that line, dims the button to `40%` opacity with strikethrough (`aria-pressed="false"`), and recalculates `yDomainMax` strictly from the remaining visible finite values so lower-latency series (e.g., Subtasks) become easier to read when high-latency Stories are hidden.
2. If all three series are hidden simultaneously (`allHidden = true`), the chart displays the centered overlay: *"All series hidden — click a legend item to show"*.

**5.1.6.7.4. Drilling Down by Series Node vs. Date Column**

1. Clicking a specific series' enlarged hover marker (`activeDot`) invokes `openDrillDown(date, series.key)` (`{ chart: "lead-time", date, series: "story" | "subtask" | "task" }`) and stops event propagation, opening `AnalyticsDrillDownDrawer` pre-filtered to that work item type.
2. Clicking anywhere else on the visible chart column invokes `openDrillDown(date)` (`{ chart: "lead-time", date }`) to list all lead-time work items completed on that date.

**5.1.6.7.5. No Completed Work Items in Window (`state = "EMPTY"`)**

1. When no completed Story, Subtask, or Task falls within `[windowStart, windowEnd]`, the backend returns `leadTimeTrend: { state: "EMPTY", points: [] }`.
2. When other widgets have data, the card displays the centered overlay: *"No work items completed in this window"*. (When the entire scope is empty, `ProjectAnalyticsPage` renders `AnalyticsEmptyState`.)

**5.1.6.7.6. Transient Loading Failure (`500` / Network Error)**

1. If the analytics query fails transiently, `WorkItemLeadTimeCard` renders `WidgetInlineError` inside the card (*"Unable to load analytics data right now. Please try again."*) with a scoped **Retry** button invoking `query.refetch()`.

#### 5.1.6.8. Business Rules and Notes

1. **End-to-End Lead Time Formula:**
   $$\text{Lead Time (days)} = \frac{\max\bigl(0,\ \text{Duration.between}(\text{createdAt},\ \text{completedAt}).\text{getSeconds}()\bigr)}{86400}$$
   - For **Story** / **Task** (`SprintBacklog`): `createdAt = item.getCreatedAt()`, `completedAt = final DONE event in BacklogItemAuditLog` (up to `completionCutoff`), falling back to `item.getUpdatedAt()`.
   - For **Subtask** (`ProjectTask`): `createdAt = subtask.getCreatedAt()`, `completedAt = final DONE event in TaskAuditLog` (`occurredAt` up to `completionCutoff`), falling back to `subtask.getUpdatedAt()`.
   - Guarantees **`Lead Time >= Cycle Time`** for every completed item (in conjunction with the `startedAt >= createdAt` guardrail in **US-ANL-005**).
2. **Series Palette & Work Type Mapping:**

   | Series Key | Legend Label | Data Source | Stroke / Marker Color | Count Field |
   | --- | --- | --- | --- | --- |
   | `story` | Story | `SprintBacklog` (`workType = STORY`) | `#2563EB` (Blue) | `storyCount` |
   | `subtask` | Subtask | `ProjectTask` (linked to in-scope backlog items when `itemType = ALL`) | `#7CB342` (Green) | `subtaskCount` |
   | `task` | Task | `SprintBacklog` (`workType = TASK` or `null` default) | `#A855F7` (Purple) | `taskCount` |

3. **Sparse Data Integrity (`null` vs. `0.0`):** A type with `0` completions on a date returns `null` (never `0.0`), and the chart sets `connectNulls={false}` so gaps remain visible and accurate.
4. **Exclusion of Open, Reopened & Post-Cutoff Items:** Only items currently in status `DONE` whose last bounded audit transition up to `completionCutoff` is `DONE` and whose `completedAt <= completionCutoff` are included.
5. **Tenant Time Zone & Rounding:** Completion dates are derived in the tenant time zone (`toTenantDate`), filtered to `[windowStart, windowEnd]`, ordered oldest first, and averaged to 1 decimal place (`Math.round(value * 10.0) / 10.0`).
6. **Dynamic Y-Axis Domain:** `yDomainMax = maxVisibleDays <= 0 ? 1 : Math.ceil(maxVisibleDays)`, recalculated exclusively from finite numeric values of currently visible series.

### 5.1.6.9. Backend Testing Evidence on Swagger

Insert Swagger UI screenshots verifying the `leadTimeTrend` payload returned by the analytics endpoint.

#### Test Case 1 – Multi-Series Lead Time Trend with Sparse Null Handling (`200 OK`)

- **API:** `GET /api/v1/projects/{projectId}/analytics` *(also mapped at `/api/projects/{projectId}/analytics`)*
- **Request Data:**
  - **Header:** `Authorization: Bearer <valid_jwt_token>`
  - **Path Parameter:** `projectId = 1`
  - **Query Parameters:** `scope=ALL` *(or `scope=SPRINT&sprintId=4` with `itemType=ALL` so Story, Subtask, and Task series are all evaluated)*
- **Expected Result:** HTTP `200 OK` with header `Cache-Control: no-store` and a `leadTimeTrend` object containing `state: "READY"`, tenant `timeZone`, ordered `series` (`story`, `subtask`, `task`), and chronologically sorted `points` with 1-decimal averages, integer counts, and `null` for types with zero completions on a given date:
  ```json
  {
    "projectId": 1,
    "leadTimeTrend": {
      "state": "READY",
      "timeZone": "Asia/Ho_Chi_Minh",
      "series": [
        { "key": "story", "label": "Story" },
        { "key": "subtask", "label": "Subtask" },
        { "key": "task", "label": "Task" }
      ],
      "points": [
        {
          "date": "2026-11-06",
          "story": 4.2,
          "storyCount": 2,
          "subtask": 1.5,
          "subtaskCount": 3,
          "task": null,
          "taskCount": 0
        },
        {
          "date": "2026-11-12",
          "story": 5.0,
          "storyCount": 1,
          "subtask": 2.1,
          "subtaskCount": 4,
          "task": 3.4,
          "taskCount": 2
        }
      ]
    }
  }
  ```
- **Actual Result:** `[Insert HTTP status code, e.g., 200 OK, confirming state="READY", three series metadata entries, 1-decimal averages, and null values on sparse dates]`

![Swagger test result for Work item lead time multi-series payload](images/us-anl-006-swagger-lead-time-trend.png)

**Figure 5.1.6-1. Swagger API test result for Work Item Lead Time Multi-Series Trend (`GET /api/v1/projects/{projectId}/analytics` – `leadTimeTrend` object)**

---

#### Test Case 2 – Scope With No Completed Stories, Subtasks, or Tasks (`state = "EMPTY"`)

- **API:** `GET /api/v1/projects/{projectId}/analytics`
- **Request Data:**
  - **Header:** `Authorization: Bearer <valid_jwt_token>`
  - **Path Parameter:** `projectId = 1`
  - **Query Parameters:** `scope=BACKLOG` *(or a date window with zero Done Story/Subtask/Task items)*
- **Expected Result:** HTTP `200 OK` returning `leadTimeTrend` with `state: "EMPTY"` and `points: []`:
  ```json
  {
    "projectId": 1,
    "leadTimeTrend": {
      "state": "EMPTY",
      "timeZone": "Asia/Ho_Chi_Minh",
      "series": [
        { "key": "story", "label": "Story" },
        { "key": "subtask", "label": "Subtask" },
        { "key": "task", "label": "Task" }
      ],
      "points": []
    }
  }
  ```
- **Actual Result:** `[Insert HTTP status code, e.g., 200 OK, confirming state="EMPTY" and empty points array]`

![Swagger test result for empty lead time trend](images/us-anl-006-swagger-lead-time-empty.png)

**Figure 5.1.6-2. Swagger API test result when no completed Story, Subtask, or Task items exist (`leadTimeTrend.state = "EMPTY"`)**

### 5.1.6.10. Frontend Screens

Insert full-screen captures of the corresponding Frontend UI screens for this Use Case.

![Work item lead time multi-series line chart with hover tooltip](images/us-anl-006-ui-lead-time-tooltip.png)

**Figure 5.1.6-3. Work Item Lead Time multi-series line chart comparing Story (blue), Subtask (green), and Task (purple) with hover tooltip showing per-series average days and item counts**

![Work item lead time legend toggled with rescaled Y-axis](images/us-anl-006-ui-lead-time-legend-toggle.png)

**Figure 5.1.6-4. Multi-series legend toggle interaction dimming hidden series and dynamically rescaling the Y-axis**
