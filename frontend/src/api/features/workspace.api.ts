import axiosInstance from "@/api/axios";
import type { WorkspaceCandidateItem, WorkspaceCreateRequest, WorkspaceDetail, WorkspaceResponse, WorkspaceProjectOption, WorkspaceMember, WorkspaceNavigation, WorkspaceSectionKey, WorkspaceSectionContent, WorkspaceSectionItem, SectionCreate, SectionReview, ProjectLog, ProjectLogCreateRequest, ProjectLogFilters, ProjectLogPage, ProjectLogOptions, ProjectLogAudit } from "@/types/features/workspace";

export const workspaceApi = {
  navigation: async (id: number, signal?: AbortSignal) =>
    (await axiosInstance.get<WorkspaceNavigation>("/workspaces/" + id + "/sections", { signal })).data,
  section: async (id: number, key: WorkspaceSectionKey, signal?: AbortSignal) =>
    (await axiosInstance.get<WorkspaceSectionContent>("/workspaces/" + id + "/" + key, { signal })).data,
  createSectionItem: async (id: number, path: string, input: SectionCreate) =>
    (await axiosInstance.post<WorkspaceSectionItem>("/workspaces/" + id + "/" + path, input)).data,
  updateTask: async (id: number, taskId: string, input: SectionCreate) =>
    (await axiosInstance.put<WorkspaceSectionItem>("/workspaces/" + id + "/tasks/" + encodeURIComponent(taskId), input)).data,
  review: async (id: number, input: SectionReview) =>
    (await axiosInstance.post<WorkspaceSectionItem>("/workspaces/" + id + "/reviews", input)).data,
  projectLogs: async (id: number, params: ProjectLogFilters, signal?: AbortSignal) =>
    (await axiosInstance.get<ProjectLogPage>(`/workspaces/${id}/logs`, { params, signal })).data,
  projectLogOptions: async (id: number, signal?: AbortSignal) =>
    (await axiosInstance.get<ProjectLogOptions>(`/workspaces/${id}/logs/options`, { signal })).data,
  createProjectLog: async (id: number, input: ProjectLogCreateRequest) =>
    (await axiosInstance.post<ProjectLog>(`/workspaces/${id}/logs`, input, { headers: { "X-Correlation-ID": crypto.randomUUID() } })).data,
  updateRiskLog: async (id: number, logId: number, input: { mitigationPlan: string; status: string }, version: number, idempotencyKey: string) =>
    (await axiosInstance.patch<ProjectLog>(`/workspaces/${id}/logs/${logId}/risk`, input, {
      headers: { "If-Match": version, "Idempotency-Key": idempotencyKey, "X-Correlation-ID": crypto.randomUUID() }
    })).data,
  projectLogHistory: async (id: number, logId: number, signal?: AbortSignal) =>
    (await axiosInstance.get<ProjectLogAudit[]>(`/workspaces/${id}/logs/${logId}/history`, { signal })).data,
  getMembers: async (id: number, signal?: AbortSignal): Promise<WorkspaceMember[]> => {
    const response = await axiosInstance.get<WorkspaceMember[]>("/workspaces/" + id + "/members", { signal });
    return response.data;
  },
  getProjectOptions: async (teamId: number): Promise<WorkspaceProjectOption[]> => {
    const response = await axiosInstance.get<WorkspaceProjectOption[]>("/workspaces/projects", { params: { teamId } });
    return response.data;
  },
  getCandidates: async (): Promise<WorkspaceCandidateItem[]> => {
    const response = await axiosInstance.get<WorkspaceCandidateItem[]>("/workspaces/candidates");
    return response.data;
  },

  confirmCreate: async (request: WorkspaceCreateRequest): Promise<WorkspaceCandidateItem> => {
    const response = await axiosInstance.post<WorkspaceCandidateItem>("/workspaces/confirm", request);
    return response.data;
  },

  getById: async (id: number, signal?: AbortSignal): Promise<WorkspaceDetail> => {
    const response = await axiosInstance.get<WorkspaceDetail>(`/workspaces/${id}`, { signal });
    return response.data;
  },

  create: async (request: WorkspaceCreateRequest, idempotencyKey: string): Promise<WorkspaceResponse> => {
    const response = await axiosInstance.post<WorkspaceResponse>("/workspaces", request, {
      headers: { "X-Idempotency-Key": idempotencyKey },
    });
    return response.data;
  },
};
