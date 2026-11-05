import axiosInstance from "@/api/axios";
import type { WorkspaceCandidateItem, WorkspaceCreateRequest, WorkspaceDetail, WorkspaceResponse, WorkspaceProjectOption, WorkspaceMember, WorkspaceNavigation, WorkspaceBoardColumn, WorkspaceSectionKey, WorkspaceSectionContent, WorkspaceSectionItem, SectionCreate, SectionReview, ProjectLog, ProjectLogCreateRequest, ProjectLogFilters, ProjectLogPage, ProjectLogOptions, ProjectLogAudit } from "@/types/features/workspace";
import type { WorkspaceResource, WorkspaceResourceCollection, WorkspaceResourceDownloadTicket, WorkspaceResourceFile, WorkspaceResourcePayload } from "@/types/features/workspace-resource";

export const workspaceApi = {
  navigation: async (id: number, signal?: AbortSignal) =>
    (await axiosInstance.get<WorkspaceNavigation>("/workspaces/" + id + "/sections", { signal })).data,
  boardColumns: async (id: number) =>
    (await axiosInstance.get<{ columns: WorkspaceBoardColumn[] }>(`/workspaces/${id}/board-columns`)).data.columns,
  updateBoardColumns: async (id: number, columns: WorkspaceBoardColumn[]) =>
    (await axiosInstance.put<{ columns: WorkspaceBoardColumn[] }>(`/workspaces/${id}/board-columns`, { columns })).data.columns,
  section: async (id: number, key: WorkspaceSectionKey, signal?: AbortSignal) =>
    (await axiosInstance.get<WorkspaceSectionContent>("/workspaces/" + id + "/" + key, { signal })).data,
  /** US-RES-004: project resources visible to the active team. */
  resources: async (id: number, signal?: AbortSignal, projectId?: number | null): Promise<WorkspaceResourceCollection> =>
    (await axiosInstance.get<WorkspaceResourceCollection>(`/workspaces/${id}/resources`, { signal, params: { projectId } })).data,
  /** US-RES-003: adds a resource to the workspace project. */
  createResource: async (id: number, payload: WorkspaceResourcePayload, projectId?: number | null): Promise<WorkspaceResource> =>
    (await axiosInstance.post<WorkspaceResource>(`/workspaces/${id}/resources`, payload, { params: { projectId } })).data,
  /** US-RES-003: edits the display fields of one workspace resource. */
  updateResource: async (id: number, resourceId: number, payload: WorkspaceResourcePayload): Promise<WorkspaceResource> =>
    (await axiosInstance.put<WorkspaceResource>(`/workspaces/${id}/resources/${resourceId}`, payload)).data,
  /** US-RES-003: removes (soft-deletes) one workspace resource. */
  deleteResource: async (id: number, resourceId: number): Promise<void> => {
    await axiosInstance.delete(`/workspaces/${id}/resources/${resourceId}`);
  },
  /** US-RES-003: uploads / replaces a document of one workspace resource. */
  uploadResourceFile: async (id: number, resourceId: number, file: File): Promise<WorkspaceResourceFile> => {
    const form = new FormData();
    form.append("file", file);
    return (await axiosInstance.post<WorkspaceResourceFile>(
      `/workspaces/${id}/resources/${resourceId}/files`,
      form,
      { headers: { "Content-Type": undefined } },
    )).data;
  },
  /** US-RES-003: removes one attached document from a workspace resource. */
  deleteResourceFile: async (id: number, resourceId: number, fileId: number): Promise<void> => {
    await axiosInstance.delete(`/workspaces/${id}/resources/${resourceId}/files/${fileId}`);
  },
  /** Requests the short-lived signed URL of one attached document. */
  downloadResource: async (id: number, resourceId: number, fileId: number) => {
    const ticket = (await axiosInstance.get<WorkspaceResourceDownloadTicket>(
      `/workspaces/${id}/resources/${resourceId}/files/${fileId}/download-ticket`,
    )).data;
    const response = await axiosInstance.get<Blob>(ticket.url, { responseType: "blob" });
    return { blob: response.data, fileName: ticket.fileName };
  },
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
  updateRiskLog: async (id: number, logId: number, input: { status: string }, version: number, idempotencyKey: string) =>
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
