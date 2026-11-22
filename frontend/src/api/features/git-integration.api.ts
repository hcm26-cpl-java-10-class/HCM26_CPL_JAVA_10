import { isAxiosError } from "axios";
import axiosInstance from "@/api/axios";
import type {
  GitHubConnectionRecheck,
  GitHubConnectionView,
  GitInstallation,
  GitSyncRequestResult,
  GitAccountCallbackRequest,
  GitAccountConnectResponse,
  GitAccountsOverview,
  GitContributorView,
  BacklogGitLinks,
  BacklogGitLinkSummary,
  GitPullRequestCandidate,
  LinkedPullRequest,
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
  GitTaskLinkRecheckResult,
  GitTaskLinkStats,
  GitBranchItem,
  GitInsightsRange,
  GitRepositoryInsights,
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

  /** US-GI-02: "Check again" an installation with GitHub (Git Integration managers). */
  recheckInstallation: async (id: number) =>
    (await axiosInstance.post<GitInstallation>(`${BASE}/installations/${id}/recheck`)).data,

  /** US-GI-02: GitHub connection of a project (a module shows its master's). */
  githubConnection: async (projectId: number, signal?: AbortSignal) =>
    (await axiosInstance.get<GitHubConnectionView>(`${PROJECTS}/${projectId}/github/connection`, { signal })).data,

  /** US-GI-02: "Check again" the project's connection (PM of the master, mentor, Git Integration manager). */
  recheckConnection: async (projectId: number) =>
    (await axiosInstance.post<GitHubConnectionRecheck>(`${PROJECTS}/${projectId}/github/connection/recheck`)).data,

  /** US-GI-04: repository of a project; a module returns its master project's repository. */
  projectRepository: async (projectId: number, signal?: AbortSignal) =>
    (await axiosInstance.get<ProjectRepositoryView>(`${PROJECTS}/${projectId}/repository`, { signal })).data,

  /** US-GI-04: link a repository to a master project (201 created, 200 already linked) and start the initial sync. */
  linkRepository: async (projectId: number, body: LinkRepositoryRequest) =>
    (await axiosInstance.post<ProjectRepositoryView>(`${PROJECTS}/${projectId}/repository`, body)).data,

  /** US-GI-05: unlink the project's repository (it becomes INACTIVE; synchronized data is kept). */
  unlinkRepository: async (projectId: number, repositoryId: number) =>
    (await axiosInstance.post<ProjectRepositoryView>(`${PROJECTS}/${projectId}/repository/unlink`, { repositoryId })).data,

  /** US-GI-04: queue the synchronization again after it failed. */
  /** US-SY-01 "Sync now": 202 = queued (or resumed), 200 = a sync was already waiting, running or just done. */
  retrySync: async (projectId: number): Promise<GitSyncRequestResult> => {
    const response = await axiosInstance.post<GitSyncJob>(`${PROJECTS}/${projectId}/repository/sync`);
    return { job: response.data, queued: response.status === 202 };
  },

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
        link: query.link,
        from: query.from || undefined,
        to: query.to || undefined,
        page: query.page ?? 0,
        size: query.size ?? 20,
        repositoryId: query.repositoryId,
      },
      signal,
    })).data,

  /** US-SY-04: pull requests, most recently updated first, with each reviewer's current decision. */
  repositoryPullRequests: async (projectId: number, query: GitPullRequestQuery, signal?: AbortSignal) =>
    (await axiosInstance.get<GitPage<GitPullRequestItem>>(`${PROJECTS}/${projectId}/repository/pull-requests`, {
      params: {
        state: query.state, q: query.q?.trim() || undefined, link: query.link, page: query.page ?? 0, size: query.size ?? 20,
        repositoryId: query.repositoryId,
      },
      signal,
    })).data,

  /** WS-GH-02: activity of the period (today included) and the current state of the open pull requests. */
  repositoryInsights: async (projectId: number, range: GitInsightsRange, signal?: AbortSignal, repositoryId?: number) =>
    (await axiosInstance.get<GitRepositoryInsights>(`${PROJECTS}/${projectId}/repository/insights`, {
      params: { range, repositoryId },
      signal,
    })).data,

  /** WS-GH-02: branches commits were first pushed to, latest activity first. */
  repositoryBranches: async (projectId: number, q: string, limit = 50, signal?: AbortSignal) =>
    (await axiosInstance.get<GitBranchItem[]>(`${PROJECTS}/${projectId}/repository/branches`, {
      params: { q: q.trim() || undefined, limit },
      signal,
    })).data,

  /** US-SY-04: one pull request with its reviews. */
  pullRequestDetail: async (projectId: number, number: number, signal?: AbortSignal, repositoryId?: number) =>
    (await axiosInstance.get<GitPullRequestDetail>(`${PROJECTS}/${projectId}/repository/pull-requests/${number}`, {
      params: { repositoryId },
      signal,
    })).data,

  /** US-SY-05: commits and pull requests linked to a task (anyone who can open the task). */
  backlogItemGitLinks: async (itemId: number, page = 0, size = 20, signal?: AbortSignal) =>
    (await axiosInstance.get<BacklogGitLinks>(`/v1/git-integration/backlog-items/${itemId}/git-links`, {
      params: { page, size },
      signal,
    })).data,

  /** US-TM-03: link a pull request of the task's repository by number (pins an automatic link). */
  linkPullRequest: async (itemId: number, number: number) =>
    (await axiosInstance.post<LinkedPullRequest>(`/v1/git-integration/backlog-items/${itemId}/git-links`, {
      type: "PULL_REQUEST",
      number,
    })).data,

  /** US-TM-03: pin an automatic link so editing the pull request no longer removes it. */
  pinGitLink: async (itemId: number, linkId: number) =>
    (await axiosInstance.patch<LinkedPullRequest>(`/v1/git-integration/backlog-items/${itemId}/git-links/${linkId}`, {
      source: "MANUAL",
    })).data,

  /** US-TM-03: unlink a pull request; it is not linked again automatically. */
  unlinkGitLink: async (itemId: number, linkId: number) => {
    await axiosInstance.delete(`/v1/git-integration/backlog-items/${itemId}/git-links/${linkId}`);
  },

  /** US-TM-03: pull requests of the task's repository to pick from (#number or title). */
  pullRequestCandidates: async (itemId: number, q: string, signal?: AbortSignal) =>
    (await axiosInstance.get<GitPullRequestCandidate[]>(`/v1/git-integration/backlog-items/${itemId}/git-links/candidates`, {
      params: { q: q || undefined },
      signal,
    })).data,

  /** US-SY-05: link counts of the tasks of a board (up to 500 ids). */
  backlogGitLinkSummary: async (itemIds: number[], signal?: AbortSignal) =>
    (await axiosInstance.get<BacklogGitLinkSummary[]>("/v1/git-integration/backlog-items/git-link-summary", {
      params: { ids: itemIds.join(",") },
      signal,
    })).data,

  /** US-SY-05: how well the repository's commits and pull requests reference tasks. */
  taskLinkStats: async (projectId: number, signal?: AbortSignal) =>
    (await axiosInstance.get<GitTaskLinkStats>(`${PROJECTS}/${projectId}/repository/task-links/stats`, { signal })).data,

  /** US-SY-05: judge unresolved Task IDs again (Git Integration managers). */
  recheckTaskLinks: async (projectId: number) =>
    (await axiosInstance.post<GitTaskLinkRecheckResult>(`${PROJECTS}/${projectId}/repository/task-links/recheck`)).data,

  /** US-SY-04: webhook deliveries of the organization (Git Integration managers only). */
  webhookEvents: async (query: GitWebhookEventQuery, signal?: AbortSignal) =>
    (await axiosInstance.get<GitPage<GitWebhookEventItem>>("/v1/git-integration/webhook-events", {
      params: { status: query.status, eventType: query.eventType, projectId: query.projectId, page: query.page ?? 0, size: query.size ?? 20 },
      signal,
    })).data,

  /** US-SY-04: process a FAILED (or IGNORED activity) event again; 202 when queued. */
  replayWebhookEvent: async (id: number) =>
    (await axiosInstance.post<{ id: number; status: string }>(`/v1/git-integration/webhook-events/${id}/replay`)).data,

  // ---- US-GI-06 · Connect GitHub account & map to project member ----

  /** CONNECTED at once when the member's GitHub account is already verified, else AUTHORIZE_REQUIRED. */
  connectAccount: async (projectId: number) =>
    (await axiosInstance.post<GitAccountConnectResponse>(`${PROJECTS}/${projectId}/github-account/connect`)).data,

  accountCallback: async (body: GitAccountCallbackRequest) =>
    (await axiosInstance.post<GitAccountConnectResponse>(`${BASE}/account-callback`, body)).data,

  githubAccounts: async (projectId: number, signal?: AbortSignal) =>
    (await axiosInstance.get<GitAccountsOverview>(`${PROJECTS}/${projectId}/github-accounts`, { signal })).data,

  unlinkAccount: async (projectId: number, userId: number) => {
    await axiosInstance.delete(`${PROJECTS}/${projectId}/github-accounts/${userId}`);
  },

  assignContributor: async (projectId: number, contributorId: number, userId: number) =>
    (await axiosInstance.post<GitContributorView>(`${PROJECTS}/${projectId}/contributors/${contributorId}/assign`, { userId })).data,

  unassignContributor: async (projectId: number, contributorId: number) =>
    (await axiosInstance.delete<GitContributorView>(`${PROJECTS}/${projectId}/contributors/${contributorId}/assign`)).data,

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
