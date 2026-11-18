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
