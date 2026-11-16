import { isAxiosError } from "axios";
import axiosInstance from "@/api/axios";
import type {
  GitHubCallbackRequest,
  GitHubCallbackResponse,
  GitHubConnectStartResponse,
  GitInstallationListResponse,
  GitIntegrationErrorBody,
  GitRepositoryPage,
  GitRepositoryQuery,
} from "@/types/features/git-integration";

const BASE = "/v1/git-integration/github";

/** GI-01: install the authorized GitHub App on a GitHub account or organization. */
export const gitIntegrationApi = {
  /** Installations of the current organization, with a summary status and whether the user may connect. */
  installations: async (signal?: AbortSignal) =>
    (await axiosInstance.get<GitInstallationListResponse>(`${BASE}/installations`, { signal })).data,

  /**
   * US-GI-03: repositories the installation can access. Search, filter and paging run on the
   * server over a 5-minute cache; `refresh` asks the server to refetch from GitHub.
   */
  repositories: async (installationId: number, query: GitRepositoryQuery, signal?: AbortSignal) =>
    (await axiosInstance.get<GitRepositoryPage>(`${BASE}/installations/${installationId}/repositories`, {
      params: {
        q: query.q?.trim() || undefined,
        filter: query.filter ?? "all",
        page: query.page ?? 0,
        size: query.size ?? 20,
        refresh: query.refresh || undefined,
        projectId: query.projectId,
      },
      signal,
    })).data,

  /** Issues a one-time state and returns the GitHub App install URL to send the browser to. */
  connect: async () => (await axiosInstance.post<GitHubConnectStartResponse>(`${BASE}/connect`)).data,

  /** Completes the flow; HTTP 202 means the install waits for an organization owner's approval. */
  callback: async (body: GitHubCallbackRequest) => {
    const response = await axiosInstance.post<GitHubCallbackResponse>(`${BASE}/callback`, body);
    return { ...response.data, httpStatus: response.status };
  },
};

export function gitIntegrationHttpStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}

/** The stable `code` of a Git Integration error response, if the server sent one. */
export function gitIntegrationErrorCode(error: unknown): string | undefined {
  if (!isAxiosError(error)) return undefined;
  const body = error.response?.data as Partial<GitIntegrationErrorBody> | undefined;
  return typeof body?.code === "string" ? body.code : undefined;
}

/** The structured error body of a Git Integration response, if any. */
export function gitIntegrationErrorBody(error: unknown): Partial<GitIntegrationErrorBody> | undefined {
  if (!isAxiosError(error)) return undefined;
  return error.response?.data as Partial<GitIntegrationErrorBody> | undefined;
}
