import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  gitIntegrationApi,
  gitIntegrationErrorCode,
  gitIntegrationHttpStatus,
} from "@/api/features/git-integration.api";
import { usePermissions } from "@/hooks/usePermissions";
import type {
  GitCommitQuery,
  GitPullRequestQuery,
  GitRepositoryQuery,
  GitWebhookEventQuery,
  LinkRepositoryRequest,
  ProjectRepositoryView,
} from "@/types/features/git-integration";
import { errorMessage, replayErrorMessage } from "./git-integration.messages";
import { savePendingConnect } from "./git-integration.storage";

export const gitIntegrationKeys = {
  all: ["git-integration"] as const,
  installations: (role?: string | null) => ["git-integration", "installations", role ?? null] as const,
  repositories: (installationId: number, query: Omit<GitRepositoryQuery, "refresh">) =>
    ["git-integration", "repositories", installationId, query.q ?? "", query.filter ?? "all",
      query.page ?? 0, query.size ?? 20, query.projectId ?? null] as const,
  projectRepository: (projectId: number) => ["git-integration", "project-repository", projectId] as const,
  activity: (projectId: number) => ["git-integration", "activity", projectId] as const,
  commits: (projectId: number, query: GitCommitQuery) =>
    ["git-integration", "commits", projectId, query.q ?? "", query.author ?? "", query.branch ?? "", query.page ?? 0, query.size ?? 20] as const,
  pullRequests: (projectId: number, query: GitPullRequestQuery) =>
    ["git-integration", "pull-requests", projectId, query.state ?? "ALL", query.q ?? "", query.page ?? 0, query.size ?? 20] as const,
  pullRequest: (projectId: number, number: number) => ["git-integration", "pull-request", projectId, number] as const,
  backlogLinks: (itemId: number, page: number) => ["git-integration", "backlog-links", itemId, page] as const,
  backlogLinkSummary: (itemIds: number[]) => ["git-integration", "backlog-link-summary", itemIds] as const,
  taskLinkStats: (projectId: number) => ["git-integration", "task-link-stats", projectId] as const,
  webhookEvents: (query: GitWebhookEventQuery) =>
    ["git-integration", "webhook-events", query.status ?? "ALL", query.eventType ?? "", query.projectId ?? null, query.page ?? 0, query.size ?? 20] as const,
};

/**
 * US-SY-04: webhooks update the data within milliseconds; the screen refreshes this
 * often while it is visible (and on window focus), never in a background tab.
 */
const ACTIVITY_POLL_MS = 30_000;
const WEBHOOK_LOG_POLL_MS = 15_000;

/** Poll while a synchronization is waiting or running, so the card moves from "Pending" to "Synced" by itself. */
const SYNC_POLL_MS = 3000;

function syncInProgress(view?: ProjectRepositoryView) {
  const status = view?.latestSync?.status;
  return view?.repository?.status === "ACTIVE" && (status === "PENDING" || status === "RUNNING");
}

/** US-GI-04: repository of a project (a module shows its master's). */
export function useProjectRepository(projectId: number | undefined) {
  return useQuery({
    queryKey: gitIntegrationKeys.projectRepository(projectId ?? 0),
    queryFn: ({ signal }) => gitIntegrationApi.projectRepository(projectId!, signal),
    enabled: projectId !== undefined,
    retry: false,
    staleTime: 0,
    refetchInterval: query => syncInProgress(query.state.data) ? SYNC_POLL_MS : false,
  });
}

/**
 * US-GI-04: link a repository to a master project. Every project repository
 * (master and its modules) and the repository lists are refreshed afterwards,
 * whether the link succeeded or was refused because the data changed.
 */
export function useLinkRepository(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LinkRepositoryRequest) => gitIntegrationApi.linkRepository(projectId, body),
    onSuccess: view => queryClient.setQueryData(gitIntegrationKeys.projectRepository(projectId), view),
    onSettled: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ["git-integration", "project-repository"] }),
      queryClient.invalidateQueries({ queryKey: ["git-integration", "repositories"] }),
    ]),
  });
}

/** US-GI-04: queue the synchronization again after it failed. */
export function useRetrySync(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => gitIntegrationApi.retrySync(projectId),
    onSuccess: () => toast.success("Synchronization queued", { description: "The repository will be synchronized again shortly." }),
    onError: error => {
      const message = errorMessage(gitIntegrationErrorCode(error), gitIntegrationHttpStatus(error));
      toast.error(message.title, { description: message.description });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["git-integration", "project-repository"] }),
  });
}

/** US-SY-04: counts, latest commit and webhook health of a project's repository. */
export function useRepositoryActivity(projectId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: gitIntegrationKeys.activity(projectId ?? 0),
    queryFn: ({ signal }) => gitIntegrationApi.repositoryActivity(projectId!, signal),
    enabled: enabled && projectId !== undefined,
    retry: false,
    refetchInterval: ACTIVITY_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useRepositoryCommits(projectId: number | undefined, query: GitCommitQuery, enabled = true) {
  return useQuery({
    queryKey: gitIntegrationKeys.commits(projectId ?? 0, query),
    queryFn: ({ signal }) => gitIntegrationApi.repositoryCommits(projectId!, query, signal),
    enabled: enabled && projectId !== undefined,
    placeholderData: keepPreviousData,
    retry: false,
    refetchInterval: ACTIVITY_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useRepositoryPullRequests(projectId: number | undefined, query: GitPullRequestQuery, enabled = true) {
  return useQuery({
    queryKey: gitIntegrationKeys.pullRequests(projectId ?? 0, query),
    queryFn: ({ signal }) => gitIntegrationApi.repositoryPullRequests(projectId!, query, signal),
    enabled: enabled && projectId !== undefined,
    placeholderData: keepPreviousData,
    retry: false,
    refetchInterval: ACTIVITY_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

/** Loaded only when a pull request is expanded. */
export function usePullRequestDetail(projectId: number, number: number | undefined) {
  return useQuery({
    queryKey: gitIntegrationKeys.pullRequest(projectId, number ?? 0),
    queryFn: ({ signal }) => gitIntegrationApi.pullRequestDetail(projectId, number!, signal),
    enabled: number !== undefined,
    retry: false,
  });
}

/** US-SY-04: webhook delivery log; refreshes while something is still waiting or retrying. */
export function useWebhookEvents(query: GitWebhookEventQuery, enabled = true) {
  return useQuery({
    queryKey: gitIntegrationKeys.webhookEvents(query),
    queryFn: ({ signal }) => gitIntegrationApi.webhookEvents(query, signal),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
    refetchInterval: result => result.state.data?.items.some(item =>
      item.status === "RECEIVED" || item.status === "PROCESSING" || item.status === "FAILED_RETRYABLE")
      ? WEBHOOK_LOG_POLL_MS : false,
    refetchIntervalInBackground: false,
  });
}

/** US-SY-04: process a failed (or ignored activity) webhook event again. */
/** US-SY-05 Task Detail: refreshed every 30 s while shown, so a push appears without reloading. */
export function useBacklogGitLinks(itemId: number | undefined, page = 0, enabled = true) {
  return useQuery({
    queryKey: gitIntegrationKeys.backlogLinks(itemId ?? 0, page),
    queryFn: ({ signal }) => gitIntegrationApi.backlogItemGitLinks(itemId!, page, 5, signal),
    enabled: enabled && itemId !== undefined,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 15_000,
    refetchInterval: ACTIVITY_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

/** US-SY-05: badge data of the tasks shown on a board, one request for all of them. */
export function useBacklogGitLinkSummary(itemIds: number[]) {
  const ids = [...new Set(itemIds)].sort((a, b) => a - b).slice(0, 500);
  return useQuery({
    queryKey: gitIntegrationKeys.backlogLinkSummary(ids),
    queryFn: ({ signal }) => gitIntegrationApi.backlogGitLinkSummary(ids, signal),
    enabled: ids.length > 0,
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

export function useTaskLinkStats(projectId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: gitIntegrationKeys.taskLinkStats(projectId ?? 0),
    queryFn: ({ signal }) => gitIntegrationApi.taskLinkStats(projectId!, signal),
    enabled: enabled && projectId !== undefined,
    retry: false,
    refetchInterval: ACTIVITY_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

/** US-SY-05: re-check unresolved Task IDs (a task restored or moved into the project gets linked). */
export function useRecheckTaskLinks(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => gitIntegrationApi.recheckTaskLinks(projectId),
    onSuccess: result => toast.success(result.nowLinked > 0
      ? `${result.nowLinked} more ${result.nowLinked === 1 ? "commit link" : "commit links"} created`
      : "Nothing new to link", {
      description: `${result.checked} unresolved Task ${result.checked === 1 ? "ID" : "IDs"} checked again.`,
    }),
    onError: error => toast.error("Re-check failed", {
      description: errorMessage(gitIntegrationErrorCode(error), gitIntegrationHttpStatus(error)).description,
    }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["git-integration"] }),
  });
}

export function useReplayWebhookEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => gitIntegrationApi.replayWebhookEvent(id),
    onSuccess: () => toast.success("Event queued", { description: "It will be processed again in a moment." }),
    onError: error => toast.error("Replay failed", { description: replayErrorMessage(gitIntegrationErrorCode(error)) }),
    onSettled: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ["git-integration", "webhook-events"] }),
      queryClient.invalidateQueries({ queryKey: ["git-integration", "activity"] }),
    ]),
  });
}

export function useGitInstallations({ enabled = true }: { enabled?: boolean } = {}) {
  const { activeRole } = usePermissions();
  return useQuery({
    queryKey: gitIntegrationKeys.installations(activeRole),
    queryFn: ({ signal }) => gitIntegrationApi.installations(signal),
    enabled,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/**
 * Starts the GitHub App install. On success the browser leaves the app, so the
 * mutation stays "pending" on purpose: the button keeps its redirecting state
 * until navigation happens and cannot be clicked twice.
 */
export function useConnectGitHub() {
  return useMutation({
    mutationFn: async () => {
      const { installUrl } = await gitIntegrationApi.connect();
      savePendingConnect();
      window.location.assign(installUrl);
      await new Promise<never>(() => undefined);
    },
    onError: (error) => {
      const message = errorMessage(gitIntegrationErrorCode(error), gitIntegrationHttpStatus(error));
      toast.error(message.title, { description: message.description });
    },
  });
}

/**
 * US-GI-03: one page of an installation's repositories. Keeps the previous page on screen
 * while the next one loads; `refresh()` asks the server to refetch from GitHub (bypassing its cache).
 */
export function useInstallationRepositories(installationId: number | undefined, query: Omit<GitRepositoryQuery, "refresh">) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const key = gitIntegrationKeys.repositories(installationId ?? 0, query);
  const result = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => gitIntegrationApi.repositories(installationId!, query, signal),
    enabled: installationId !== undefined,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
  });

  const refresh = useCallback(async () => {
    if (installationId === undefined) return;
    setRefreshing(true);
    try {
      const fresh = await gitIntegrationApi.repositories(installationId, { ...query, refresh: true });
      queryClient.setQueryData(key, fresh);
      // Other pages/searches of this installation now come from the refreshed server cache.
      void queryClient.invalidateQueries({ queryKey: ["git-integration", "repositories", installationId], refetchType: "none" });
    } catch {
      await result.refetch();
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationId, queryClient, JSON.stringify(key)]);

  return { ...result, refresh, refreshing };
}
