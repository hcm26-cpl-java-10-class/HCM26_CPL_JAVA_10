/** US-ANL-001: read-only Project Analytics workspace. US-ANL-002: scope filters. */

/** How the scope filter narrows the project work items. */
export type ProjectAnalyticsScope = "ALL" | "BACKLOG" | "SPRINT";

/** Work item type filter (`SprintBacklogWorkType` + the "no filter" option). */
export type ProjectAnalyticsItemType = "ALL" | "STORY" | "BUG" | "TASK";

/** Bucket size of the trend charts. */
export type ProjectAnalyticsGranularity = "DAY" | "WEEK" | "MONTH";

export type ProjectAnalyticsWidgetState = "PLACEHOLDER" | "READY" | "EMPTY";

export type ProjectAnalyticsChartKind = "BAR" | "AREA" | "LINE";

/** One entry of the Scope/Sprint dropdown, ordered chronologically. */
export interface ProjectAnalyticsSprintOption {
  sprintId: number;
  name: string;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  workItemCount: number;
}

/** The filter the backend actually applied, plus the option lists. */
export interface ProjectAnalyticsFilters {
  scope: ProjectAnalyticsScope;
  sprintId: number | null;
  itemType: ProjectAnalyticsItemType;
  startDate: string | null;
  endDate: string | null;
  sprints: ProjectAnalyticsSprintOption[];
  defaultSprintId: number | null;
  backlogItemCount: number;
  itemTypes: ProjectAnalyticsItemType[];
}

/** Effective chart window (may differ from the requested dates). */
export interface ProjectAnalyticsWindow {
  startDate: string;
  endDate: string;
  granularity: ProjectAnalyticsGranularity;
}

/** Measurement of a KPI value: item count, percentage or day average. */
export type ProjectAnalyticsKpiUnit = "items" | "percent" | "days";

/**
 * One card of the US-ANL-003 summary strip.
 *
 * `value` is already formatted by the backend (`"20"`, `"75.0%"`,
 * `"2.4 days"`, `"N/A"`) so the 1-decimal rule and the N/A fallback of AC02
 * cannot drift between the API and the UI.
 */
export interface ProjectAnalyticsKpi {
  key: string;
  label: string;
  value: string;
  unit: ProjectAnalyticsKpiUnit;
  hint: string;
  /** Sub-label, e.g. `15 Done / 5 To do` on the Total Work Items card. */
  caption: string | null;
  /** Second sub-label, e.g. the `30.0h / 40.0h` estimate split (AC03). */
  subCaption: string | null;
}

/** One X-axis bucket: activity counts plus the status snapshot at its end. */
export interface ProjectAnalyticsBucket {
  date: string;
  created: number;
  completed: number;
  todo: number;
  inProgress: number;
  review: number;
  done: number;
  remaining: number;
  ideal: number;
}

export interface ProjectAnalyticsSeries {
  key: Exclude<keyof ProjectAnalyticsBucket, "date">;
  label: string;
}

/**
 * US-ANL-004: one creation-date bucket of the stacked bar chart.
 *
 * `done` is the blue bottom segment (items created that day that are now
 * Done) and `todo` the green cap (items still open: To do, In progress,
 * Review or Blocked). `done + todo` is the number of items created on `date`.
 */
export interface ProjectAnalyticsCreationBucket {
  date: string;
  done: number;
  todo: number;
}

/** US-ANL-004: "Work item creation trend" chart, one bar per creation date. */
export interface ProjectAnalyticsCreationTrend {
  state: ProjectAnalyticsWidgetState;
  series: ProjectAnalyticsSeries[];
  buckets: ProjectAnalyticsCreationBucket[];
}

/**
 * US-ANL-005: one point of the "Work item cycle time" line chart.
 *
 * `averageDays` is the mean active execution time (first In progress → final
 * Done) of the items completed on `date` (tenant time zone), one decimal.
 */
export interface ProjectAnalyticsCycleTimePoint {
  date: string;
  averageDays: number;
  itemCount: number;
}

/** US-ANL-005: "Work item cycle time" chart, one point per completion date. */
export interface ProjectAnalyticsCycleTimeTrend {
  state: ProjectAnalyticsWidgetState;
  timeZone: string;
  points: ProjectAnalyticsCycleTimePoint[];
}

/** US-ANL-006: work item types compared in the multi-series lead time chart. */
export type ProjectAnalyticsLeadTimeSeriesKey = "story" | "subtask" | "task";

export interface ProjectAnalyticsLeadTimeSeries {
  key: ProjectAnalyticsLeadTimeSeriesKey;
  label: string;
}

/**
 * US-ANL-006: one completion-date point of the "Work item lead time" chart.
 *
 * Each series average is `null` on dates with zero completions of that type
 * so sparse series leave a clean gap instead of plotting false zero values (AC02).
 */
export interface ProjectAnalyticsLeadTimePoint {
  date: string;
  story: number | null;
  storyCount: number;
  subtask: number | null;
  subtaskCount: number;
  task: number | null;
  taskCount: number;
}

/** US-ANL-006: "Work item lead time" multi-series line chart (Story / Subtask / Task). */
export interface ProjectAnalyticsLeadTimeTrend {
  state: ProjectAnalyticsWidgetState;
  timeZone: string;
  series: ProjectAnalyticsLeadTimeSeries[];
  points: ProjectAnalyticsLeadTimePoint[];
}

/** US-ANL-007: work item types stacked in the completion trend bar chart. */
export type ProjectAnalyticsCompletionSeriesKey = "subtask" | "story" | "task";

export interface ProjectAnalyticsCompletionSeries {
  key: ProjectAnalyticsCompletionSeriesKey;
  label: string;
}

/**
 * US-ANL-007: one completion-date bucket of the "Work item completion trend" chart.
 *
 * `subtask` is the blue bottom segment (`#2563EB`), `story` the green segment
 * (`#7CB342`), and `task` the purple segment (`#A855F7` when Task items exist).
 */
export interface ProjectAnalyticsCompletionBucket {
  date: string;
  subtask: number;
  story: number;
  task: number;
}

/** US-ANL-007: "Work item completion trend" stacked bar chart. */
export interface ProjectAnalyticsCompletionTrend {
  state: ProjectAnalyticsWidgetState;
  timeZone: string;
  series: ProjectAnalyticsCompletionSeries[];
  buckets: ProjectAnalyticsCompletionBucket[];
}

export interface ProjectAnalyticsWidget {
  key: string;
  title: string;
  description: string;
  state: ProjectAnalyticsWidgetState;
  kind: ProjectAnalyticsChartKind;
  series: ProjectAnalyticsSeries[];
  buckets: ProjectAnalyticsBucket[];
}

export interface ProjectAnalyticsShell {
  projectId: number;
  projectCode: string | null;
  projectName: string | null;
  projectStatus: string | null;
  readOnly: boolean;
  filters: ProjectAnalyticsFilters;
  window: ProjectAnalyticsWindow;
  kpis: ProjectAnalyticsKpi[];
  creationTrend: ProjectAnalyticsCreationTrend;
  cycleTimeTrend: ProjectAnalyticsCycleTimeTrend;
  leadTimeTrend: ProjectAnalyticsLeadTimeTrend;
  completionTrend: ProjectAnalyticsCompletionTrend;
  widgets: ProjectAnalyticsWidget[];
}

/**
 * Filters the page sends to the API. Every field is optional: the backend
 * resolves the default scope (active sprint, otherwise all work items).
 */
export interface ProjectAnalyticsRequestFilters {
  scope?: ProjectAnalyticsScope;
  sprintId?: number;
  itemType?: ProjectAnalyticsItemType;
  startDate?: string;
  endDate?: string;
}

/** One option in the Learning Analytics project selector. */
export interface ProjectAnalyticsProjectOption {
  projectId: number;
  code: string | null;
  name: string | null;
  status: string | null;
}

/** US-ANL-008: chart identifiers supported by the click-to-drill-down drawer. */
export type ProjectAnalyticsDrillDownChart = "creation" | "cycle-time" | "lead-time" | "completion";

/** US-ANL-008: clicked data point / bar segment passed to the drill-down drawer. */
export interface ProjectAnalyticsDrillDownTarget {
  chart: ProjectAnalyticsDrillDownChart;
  date: string;
  series?: string;
}

/** US-ANL-008: one underlying work item row inside the drill-down drawer. */
export interface ProjectAnalyticsDrillDownItem {
  id: string;
  backlogItemId: number | null;
  taskCode: string;
  title: string | null;
  workType: "STORY" | "SUBTASK" | "TASK" | "BUG" | string;
  status: string;
  assigneeName: string | null;
  sprintId: number | null;
  sprintName: string | null;
  createdDate: string | null;
  completedDate: string | null;
  cycleDays: number | null;
  leadDays: number | null;
}

/** US-ANL-008: response payload of `GET /v1/projects/{projectId}/analytics/drill-down`. */
export interface ProjectAnalyticsDrillDownResponse {
  projectId: number;
  projectCode: string | null;
  chart: ProjectAnalyticsDrillDownChart;
  date: string;
  series: string | null;
  totalCount: number;
  items: ProjectAnalyticsDrillDownItem[];
}
