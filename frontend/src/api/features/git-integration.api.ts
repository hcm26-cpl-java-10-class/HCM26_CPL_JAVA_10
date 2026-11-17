import { isAxiosError } from "axios";
import axiosInstance from "@/api/axios";
import type {
  GitHubCallbackRequest,
  GitHubCallbackResponse,
  GitHubConnectStartResponse,
  GitInstallationListResponse,
  GitIntegrationErrorBody,
  GitCommitItem,
  GitCommitQuery,
  GitPage,
  GitPullRequestDetail,
  GitPullRequestItem,
  GitPullRequestQuery,
  GitRepositoryActivity,
  GitRepositoryPage,
  GitRepositoryQuery,
  GitSyncJob,
  GitWebhookEventItem,
  GitWebhookEventQuery,
  LinkRepositoryRequest,
  ProjectRepositoryView,
} from "@/types/features/git-integration";

const BASE = "/v1/git-integration/github";
const PROJECTS = "/v1/git-integration/projects";

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

  /** US-GI-04: repository of a project; a module returns its master project's repository. */
  projectRepository: async (projectId: number, signal?: AbortSignal) =>
    (await axiosInstance.get<ProjectRepositoryView>(`${PROJECTS}/${projectId}/repository`, { signal })).data,

  /** US-GI-04: link a repository to a master project (201 created, 200 already linked) and start the initial sync. */
  linkRepository: async (projectId: number, body: LinkRepositoryRequest) =>
    (await axiosInstance.post<ProjectRepositoryView>(`${PROJECTS}/${projectId}/repository`, body)).data,

  /** US-GI-04: queue the synchronization again after it failed. */
  retrySync: async (projectId: number) =>
    (await axiosInstance.post<GitSyncJob>(`${PROJECTS}/${projectId}/repository/sync`)).data,

  /** US-SY-04: counts, latest commit and webhook health of a project's repository. */
  repositoryActivity: async (projectId: number, signal?: AbortSignal) =>
    (await axiosInstance.get<GitRepositoryActivity>(`${PROJECTS}/${projectId}/repository/activity`, { signal })).data,

  /** US-SY-04: commits synchronized from push webhooks, newest first. */
  repositoryCommits: async (projectId: number, query: GitCommitQuery, signal?: AbortSignal) =>
    (await axiosInstance.get<GitPage<GitCommitItem>>(`${PROJECTS}/${projectId}/repository/commits`, {
      params: {
        q: query.q?.trim() || undefined,
        author: query.author?.trim() || undefined,
        branch: query.branch?.trim() || undefined,
        page: query.page ?? 0,
        size: query.size ?? 20,
      },
      signal,
    })).data,

  /** US-SY-04: pull requests, most recently updated first, with each reviewer's current decision. */
  repositoryPullRequests: async (projectId: number, query: GitPullRequestQuery, signal?: AbortSignal) =>
    (await axiosInstance.get<GitPage<GitPullRequestItem>>(`${PROJECTS}/${projectId}/repository/pull-requests`, {
      params: { state: query.state, q: query.q?.trim() || undefined, page: query.page ?? 0, size: query.size ?? 20 },
      signal,
    })).data,

  /** US-SY-04: one pull request with its reviews. */
  pullRequestDetail: async (projectId: number, number: number, signal?: AbortSignal) =>
    (await axiosInstance.get<GitPullRequestDetail>(`${PROJECTS}/${projectId}/repository/pull-requests/${number}`, { signal })).data,

  /** US-SY-04: webhook deliveries of the organization (Git Integration managers only). */
  webhookEvents: async (query: GitWebhookEventQuery, signal?: AbortSignal) =>
    (await axiosInstance.get<GitPage<GitWebhookEventItem>>("/v1/git-integration/webhook-events", {
      params: { status: query.status, eventType: query.eventType, projectId: query.projectId, page: query.page ?? 0, size: query.size ?? 20 },
      signal,
    })).data,

  /** US-SY-04: process a FAILED (or IGNORED activity) event again; 202 when queued. */
  replayWebhookEvent: async (id: number) =>
    (await axiosInstance.post<{ id: number; status: string }>(`/v1/git-integration/webhook-events/${id}/replay`)).data,

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
