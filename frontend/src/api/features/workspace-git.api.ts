import api from "@/api/axios";

export interface WorkspaceGitConfig {
  workspaceId: number;
  configured: boolean;
  repositoryUrl: string | null;
  repositoryWebUrl: string | null;
  provider: string | null;
  defaultBranch: string | null;
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  canEdit: boolean;
  canUnlink: boolean;
}
export interface WorkspaceGitInput {
  version: number;
  repositoryUrl: string;
  defaultBranch: string;
  repositoryWebUrl?: string;
}
export const workspaceGitApi = {
  get: async (id: number, signal?: AbortSignal) =>
    (await api.get<WorkspaceGitConfig>(`/workspaces/${id}/git-config`, { signal })).data,
  save: async (id: number, input: WorkspaceGitInput) =>
    (await api.put<WorkspaceGitConfig>(`/workspaces/${id}/git-config`, input)).data,
  unlink: async (id: number, version: number) =>
    (await api.delete<WorkspaceGitConfig>(`/workspaces/${id}/git-config`, { params: { version } })).data,
};
