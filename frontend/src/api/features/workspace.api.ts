import axiosInstance from "@/api/axios";
import type { WorkspaceCandidateItem, WorkspaceCreateRequest, WorkspaceDetail, WorkspaceResponse, WorkspaceProjectOption } from "@/types/features/workspace";

export const workspaceApi = {
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

  getById: async (id: number): Promise<WorkspaceDetail> => {
    const response = await axiosInstance.get<WorkspaceDetail>(`/workspaces/${id}`);
    return response.data;
  },

  create: async (request: WorkspaceCreateRequest, idempotencyKey: string): Promise<WorkspaceResponse> => {
    const response = await axiosInstance.post<WorkspaceResponse>("/workspaces", request, {
      headers: { "X-Idempotency-Key": idempotencyKey },
    });
    return response.data;
  },
};
