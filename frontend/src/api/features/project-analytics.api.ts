import axiosInstance from "@/api/axios";
import type { ProjectAnalyticsProjectOption, ProjectAnalyticsShell } from "@/types/features/project-analytics";

/**
 * US-ANL-001: read-only Analytics endpoints.
 *
 * Every call is a GET; opening Analytics must never mutate sprint, task or
 * audit state.
 */
export const projectAnalyticsApi = {
  /** Reads the analytics shell for one project (HTTP 401/403/404 are surfaced to the page). */
  shell: async (projectId: number, signal?: AbortSignal) =>
    (await axiosInstance.get<ProjectAnalyticsShell>(`/v1/projects/${projectId}/analytics`, { signal })).data,

  /** Lists the projects the signed-in mentor / PM / member may open Analytics for. */
  projects: async (signal?: AbortSignal) =>
    (await axiosInstance.get<ProjectAnalyticsProjectOption[]>("/v1/projects/analytics/options", { signal })).data,
};
