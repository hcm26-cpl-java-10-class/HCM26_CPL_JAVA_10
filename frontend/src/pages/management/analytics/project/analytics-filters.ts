import type {
  ProjectAnalyticsItemType,
  ProjectAnalyticsRequestFilters,
  ProjectAnalyticsScope,
} from "@/types/features/project-analytics";

/**
 * US-ANL-002: the Analytics filter state lives in the URL so a filtered view
 * survives a reload, a shared link and the sidebar remount that happens on
 * every workspace navigation.
 *
 * Read is whitelist-validated (an unknown scope or a malformed date is simply
 * ignored), write deletes the keys first so a cleared filter never lingers.
 */
export const analyticsFilterKeys = ["scope", "sprintId", "startDate", "endDate", "itemType"] as const;

const scopes: ProjectAnalyticsScope[] = ["ALL", "BACKLOG", "SPRINT"];
const itemTypes: ProjectAnalyticsItemType[] = ["ALL", "STORY", "BUG", "TASK"];

export const scopeLabels: Record<ProjectAnalyticsScope, string> = {
  ALL: "All work items",
  BACKLOG: "Product backlog",
  SPRINT: "Sprint scope",
};

export const itemTypeLabels: Record<ProjectAnalyticsItemType, string> = {
  ALL: "All work item types",
  STORY: "Story",
  BUG: "Bug",
  TASK: "Task",
};

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Reads the applied filters from the current search params. */
export function readAnalyticsFilters(params: URLSearchParams): ProjectAnalyticsRequestFilters {
  const result: ProjectAnalyticsRequestFilters = {};

  const scope = params.get("scope");
  if (scope && scopes.includes(scope as ProjectAnalyticsScope)) result.scope = scope as ProjectAnalyticsScope;

  const sprintId = Number(params.get("sprintId"));
  if (Number.isSafeInteger(sprintId) && sprintId > 0) result.sprintId = sprintId;

  const itemType = params.get("itemType");
  if (itemType && itemTypes.includes(itemType as ProjectAnalyticsItemType)) {
    result.itemType = itemType as ProjectAnalyticsItemType;
  }

  const startDate = params.get("startDate");
  if (startDate && isIsoDate(startDate)) result.startDate = startDate;

  const endDate = params.get("endDate");
  if (endDate && isIsoDate(endDate)) result.endDate = endDate;

  return result;
}

/** Writes the filters into the search params, keeping every unrelated key. */
export function writeAnalyticsFilters(
  current: URLSearchParams,
  filters: ProjectAnalyticsRequestFilters,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const key of analyticsFilterKeys) next.delete(key);
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    next.set(key, String(value));
  }
  return next;
}

/** Removes every analytics filter, keeping `tab`, `project`, … untouched. */
export function clearAnalyticsFilters(current: URLSearchParams): URLSearchParams {
  return writeAnalyticsFilters(current, {});
}

/** True when the applied filters carry at least one explicit restriction. */
export function hasAnalyticsFilters(filters: ProjectAnalyticsRequestFilters) {
  return Object.values(filters).some(value => value !== undefined && value !== null && value !== "");
}
