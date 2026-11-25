import axiosInstance from "@/api/axios";
import type {
  ProjectAnalyticsDrillDownResponse,
  ProjectAnalyticsDrillDownTarget,
  ProjectAnalyticsExportFormat,
  ProjectAnalyticsProjectOption,
  ProjectAnalyticsRequestFilters,
  ProjectAnalyticsShell,
} from "@/types/features/project-analytics";

/** Extracts a safe filename from a `Content-Disposition` header, if exposed. */
function filenameFromDisposition(header: unknown, fallback: string) {
  if (typeof header !== "string") return fallback;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(header);
  return plainMatch?.[1] || fallback;
}

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

  /**
   * US-ANL-010: exports the filtered Sprint & Backlog analytics report as CSV,
   * multi-sheet Excel (XLSX), or PDF via a secure binary stream and records an
   * immutable audit entry.
   */
  exportReport: async (
    projectId: number,
    format: ProjectAnalyticsExportFormat,
    filters?: ProjectAnalyticsRequestFilters,
    fallbackPrefix?: string | null,
  ) => {
    const response = await axiosInstance.post<Blob>(
      `/v1/projects/${projectId}/analytics/export`,
      {
        format,
        scope: filters?.scope,
        sprintId: filters?.sprintId,
        startDate: filters?.startDate,
        endDate: filters?.endDate,
        itemType: filters?.itemType,
      },
      { responseType: "blob" },
    );
    const ext = format === "CSV" ? "csv" : format === "XLSX" ? "xlsx" : "pdf";
    const prefix = (fallbackPrefix?.trim() || `project-${projectId}`).toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const fallbackName = `${prefix}-analytics.${ext}`;
    const filename = filenameFromDisposition(response.headers?.["content-disposition"], fallbackName);
    return { blob: response.data, filename };
  },
};
