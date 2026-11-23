import axiosInstance from "@/api/axios";
import type { FinalizeProjectRequest, ProjectCompletionResult, ProjectCompletionSummary } from "@/types/features/project-completion";

/** A shared (SPLIT) master project has no team; every other project is addressed through its owning team. */
const projectPath = (projectId: number, teamId: number | null) =>
  teamId == null ? `/projects/${projectId}` : `/projects/${projectId}/teams/${teamId}`;

export const projectCompletionApi = {
  async summary(projectId: number, teamId: number | null, signal?: AbortSignal) {
    return (await axiosInstance.get<ProjectCompletionSummary>(`${projectPath(projectId, teamId)}/completion`, { signal })).data;
  },
  async finalize(projectId: number, teamId: number | null, request: FinalizeProjectRequest) {
    return (await axiosInstance.post<ProjectCompletionResult>(`${projectPath(projectId, teamId)}/finalize`, request)).data;
  },
};
