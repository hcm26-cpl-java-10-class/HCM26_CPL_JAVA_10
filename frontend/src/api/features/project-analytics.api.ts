import axiosInstance from "@/api/axios";
import type {
  ProjectAnalyticsDrillDownResponse,
  ProjectAnalyticsDrillDownTarget,
  ProjectAnalyticsProjectOption,
  ProjectAnalyticsRequestFilters,
  ProjectAnalyticsShell,
} from "@/types/features/project-analytics";

/** Drops optional filters so the query string only carries what was chosen. */
function toParams(filters?: ProjectAnalyticsRequestFilters) {
  if (!filters) return undefined;
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params[key] = value;
  }
  return Object.keys(params).length > 0 ? params : undefined;
}

/**
 * US-ANL-001 / US-ANL-002: read-only Analytics endpoints.
 *
 * Every call is a GET; opening Analytics must never mutate sprint, task or
 * audit state.
 */
export const projectAnalyticsApi = {
  /**
   * Reads the filtered analytics payload (filters echo, KPI cards and the four
   * trend charts) for one project. HTTP 401/403/404 are surfaced to the page,
   * HTTP 422 carries the field keyed filter errors.
   */
  shell: async (projectId: number, filters?: ProjectAnalyticsRequestFilters, signal?: AbortSignal) =>
    (await axiosInstance.get<ProjectAnalyticsShell>(`/v1/projects/${projectId}/analytics`, {
      params: toParams(filters),
      signal,
    })).data,

  /** Lists the projects the signed-in mentor / PM / member may open Analytics for. */
  projects: async (signal?: AbortSignal) =>
    (await axiosInstance.get<ProjectAnalyticsProjectOption[]>("/v1/projects/analytics/options", { signal })).data,

  /**
   * US-ANL-008: reads the underlying work items behind one clicked bar segment
   * or line marker, preserving the applied scope/date/type filter.
   */
  drillDown: async (
    projectId: number,
    target: ProjectAnalyticsDrillDownTarget,
    filters?: ProjectAnalyticsRequestFilters,
    signal?: AbortSignal,
  ) =>
    (await axiosInstance.get<ProjectAnalyticsDrillDownResponse>(`/v1/projects/${projectId}/analytics/drill-down`, {
      params: {
        ...toParams(filters),
        chart: target.chart,
        date: target.date,
        ...(target.series ? { series: target.series } : {}),
      },
      signal,
    })).data,
};
