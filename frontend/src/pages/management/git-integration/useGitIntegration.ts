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
  GitAccountsOverview,
  BacklogGitLinks,
  GitCommitQuery,
  GitInsightsRange,
  GitPullRequestQuery,
  GitRepositoryQuery,
  GitWebhookEventQuery,
  LinkRepositoryRequest,
  ProjectRepositoryView,
} from "@/types/features/git-integration";
import { accountErrorMessage, errorMessage, replayErrorMessage, taskLinkErrorMessage } from "./git-integration.messages";
import { savePendingAccountConnect, savePendingConnect } from "./git-integration.storage";

export const gitIntegrationKeys = {
  all: ["git-integration"] as const,
  installations: (role?: string | null) => ["git-integration", "installations", role ?? null] as const,
  repositories: (installationId: number, query: Omit<GitRepositoryQuery, "refresh">) =>
    ["git-integration", "repositories", installationId, query.q ?? "", query.filter ?? "all",
      query.page ?? 0, query.size ?? 20, query.projectId ?? null] as const,
  projectRepository: (projectId: number) => ["git-integration", "project-repository", projectId] as const,
  activity: (projectId: number) => ["git-integration", "activity", projectId] as const,
  commits: (projectId: number, query: GitCommitQuery) =>
    ["git-integration", "commits", projectId, query.q ?? "", query.author ?? "", query.branch ?? "", query.link ?? "ALL",
      query.from ?? "", query.to ?? "", query.page ?? 0, query.size ?? 20] as const,
  pullRequests: (projectId: number, query: GitPullRequestQuery) =>
    ["git-integration", "pull-requests", projectId, query.state ?? "ALL", query.q ?? "", query.link ?? "ALL",
      query.page ?? 0, query.size ?? 20] as const,
  pullRequest: (projectId: number, number: number) => ["git-integration", "pull-request", projectId, number] as const,
  insights: (projectId: number, range: GitInsightsRange) => ["git-integration", "insights", projectId, range] as const,
  branches: (projectId: number, q: string) => ["git-integration", "branches", projectId, q] as const,
  backlogLinks: (itemId: number, page: number, size: number) => ["git-integration", "backlog-links", itemId, page, size] as const,
  backlogLinkSummary: (itemIds: number[]) => ["git-integration", "backlog-link-summary", itemIds] as const,
  taskLinkStats: (projectId: number) => ["git-integration", "task-link-stats", projectId] as const,
  pullRequestCandidates: (itemId: number, q: string) => ["git-integration", "pull-request-candidates", itemId, q] as const,
  githubAccounts: (projectId: number) => ["git-integration", "github-accounts", projectId] as const,
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

/** WS-GH-02: daily counts change slowly, so a minute between refreshes is enough. */
const INSIGHTS_POLL_MS = 60_000;

/** WS-GH-02: activity insights of the period; keeps the previous range on screen while the next loads. */
export function useRepositoryInsights(projectId: number | undefined, range: GitInsightsRange, enabled = true) {
  return useQuery({
    queryKey: gitIntegrationKeys.insights(projectId ?? 0, range),
    queryFn: ({ signal }) => gitIntegrationApi.repositoryInsights(projectId!, range, signal),
    enabled: enabled && projectId !== undefined,
    placeholderData: keepPreviousData,
    staleTime: INSIGHTS_POLL_MS,
    retry: false,
    refetchInterval: INSIGHTS_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

/** WS-GH-02: branches for the branch picker; only loaded while the picker is open. */
export function useRepositoryBranches(projectId: number | undefined, q: string, enabled: boolean) {
  return useQuery({
    queryKey: gitIntegrationKeys.branches(projectId ?? 0, q),
    queryFn: ({ signal }) => gitIntegrationApi.repositoryBranches(projectId!, q, 50, signal),
    enabled: enabled && projectId !== undefined,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    retry: false,
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
/** `size`: commits per page (the Development preview needs a few, its "View all" view a full page). */
export function useBacklogGitLinks(itemId: number | undefined, page = 0, enabled = true, size = 5) {
  return useQuery({
    queryKey: gitIntegrationKeys.backlogLinks(itemId ?? 0, page, size),
    queryFn: ({ signal }) => gitIntegrationApi.backlogItemGitLinks(itemId!, page, size, signal),
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

/** US-TM-03: pull requests to pick from in the "Link PR" popover; only while it is open. */
export function usePullRequestCandidates(itemId: number, q: string, enabled: boolean) {
  return useQuery({
    queryKey: gitIntegrationKeys.pullRequestCandidates(itemId, q),
    queryFn: ({ signal }) => gitIntegrationApi.pullRequestCandidates(itemId, q, signal),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
  });
}

/** Everything that shows the links of a task: its Development section, board badges, pull request lists, picker. */
function invalidateTaskLinks(queryClient: ReturnType<typeof useQueryClient>, itemId: number) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["git-integration", "backlog-links", itemId] }),
    queryClient.invalidateQueries({ queryKey: ["git-integration", "backlog-link-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["git-integration", "pull-requests"] }),
    queryClient.invalidateQueries({ queryKey: ["git-integration", "pull-request-candidates", itemId] }),
  ]);
}

/** Applies a change to every cached page of a task's links; returns the previous pages for rollback. */
function patchTaskLinks(queryClient: ReturnType<typeof useQueryClient>, itemId: number,
  patch: (view: BacklogGitLinks) => BacklogGitLinks) {
  const key = ["git-integration", "backlog-links", itemId];
  const previous = queryClient.getQueriesData<BacklogGitLinks>({ queryKey: key });
  queryClient.setQueriesData<BacklogGitLinks>({ queryKey: key }, view => view && patch(view));
  return previous;
}

/** US-TM-03: link a pull request to a task by number (an automatic link of the pair becomes manual). */
export function useLinkPullRequest(itemId: number, taskKey?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (number: number) => gitIntegrationApi.linkPullRequest(itemId, number),
    onSuccess: linked => toast.success(`Linked #${linked.pullRequest.number}${taskKey ? ` to ${taskKey}` : ""}`, {
      description: "It stays linked even if the Task ID is removed from the pull request.",
    }),
    onError: error => toast.error("Could not link the pull request", {
      description: taskLinkErrorMessage(gitIntegrationErrorCode(error), gitIntegrationHttpStatus(error)),
    }),
    onSettled: () => invalidateTaskLinks(queryClient, itemId),
  });
}

/** US-TM-03: keep an automatic link even when the Task ID is edited out of the pull request. */
export function usePinGitLink(itemId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkId: number) => gitIntegrationApi.pinGitLink(itemId, linkId),
    onMutate: async linkId => {
      await queryClient.cancelQueries({ queryKey: ["git-integration", "backlog-links", itemId] });
      return patchTaskLinks(queryClient, itemId, view => ({
        ...view,
        pullRequests: view.pullRequests.map(row => row.link.id === linkId
          ? { ...row, link: { ...row.link, source: "MANUAL", field: null } } : row),
      }));
    },
    onSuccess: linked => toast.success(`#${linked.pullRequest.number} pinned`, {
      description: "It stays linked even if the Task ID is removed from the pull request.",
    }),
    onError: (error, _linkId, previous) => {
      previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error("Could not pin the link", {
        description: taskLinkErrorMessage(gitIntegrationErrorCode(error), gitIntegrationHttpStatus(error)),
      });
    },
    onSettled: () => invalidateTaskLinks(queryClient, itemId),
  });
}

/**
 * US-TM-03: unlink a pull request. Removed from the list at once; the toast offers Undo
 * for 5 s instead of a confirmation dialog (Undo links it again, manually).
 */
export function useUnlinkGitLink(itemId: number, taskKey?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ linkId }: { linkId: number; number: number }) => {
      try {
        await gitIntegrationApi.unlinkGitLink(itemId, linkId);
      } catch (error) {
        if (gitIntegrationErrorCode(error) !== "GIT_TASK_LINK_NOT_FOUND") throw error; // already removed
      }
    },
    onMutate: async ({ linkId }) => {
      await queryClient.cancelQueries({ queryKey: ["git-integration", "backlog-links", itemId] });
      return patchTaskLinks(queryClient, itemId, view => {
        const pullRequests = view.pullRequests.filter(row => row.link.id !== linkId);
        return { ...view, pullRequests, pullRequestCount: pullRequests.length };
      });
    },
    onSuccess: (_result, { number }) => toast.success(`Unlinked #${number}${taskKey ? ` from ${taskKey}` : ""}`, {
      description: "It won't be linked again automatically.",
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          gitIntegrationApi.linkPullRequest(itemId, number)
            .catch(error => toast.error("Could not undo", {
              description: taskLinkErrorMessage(gitIntegrationErrorCode(error), gitIntegrationHttpStatus(error)),
            }))
            .finally(() => void invalidateTaskLinks(queryClient, itemId));
        },
      },
    }),
    onError: (error, _variables, previous) => {
      previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error("Could not unlink the pull request", {
        description: taskLinkErrorMessage(gitIntegrationErrorCode(error), gitIntegrationHttpStatus(error)),
      });
    },
    onSettled: () => invalidateTaskLinks(queryClient, itemId),
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

// ---- US-GI-06 · Connect GitHub account & map to project member ----------------------------------

/** Everything a mapping change affects: the accounts of every project and the insights' contributors. */
function invalidateMapping(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["git-integration", "github-accounts"] }),
    queryClient.invalidateQueries({ queryKey: ["git-integration", "insights"] }),
  ]);
}

function toastAccountError(error: unknown) {
  const message = accountErrorMessage(gitIntegrationErrorCode(error), gitIntegrationHttpStatus(error));
  toast.error(message.title, { description: message.description });
}

/** GitHub accounts of a project's master: the viewer's own state, members and unmapped contributors. */
export function useGitHubAccounts(projectId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: gitIntegrationKeys.githubAccounts(projectId ?? 0),
    queryFn: ({ signal }) => gitIntegrationApi.githubAccounts(projectId!, signal),
    enabled: enabled && projectId !== undefined,
    retry: false,
    staleTime: 30_000,
  });
}

/**
 * "Connect GitHub account": a verified account is mapped at once (toast, no redirect); otherwise the
 * browser goes to GitHub and the callback page brings the user back to {@code returnTo}.
 */
export function useConnectAccount(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => gitIntegrationApi.connectAccount(projectId),
    onSuccess: result => {
      if (result.outcome === "AUTHORIZE_REQUIRED" && result.authorizeUrl) {
        savePendingAccountConnect(projectId, window.location.pathname + window.location.search);
        window.location.assign(result.authorizeUrl);
        return;
      }
      toast.success("GitHub connected", {
        description: result.account ? `Activity of @${result.account.login} now counts for you in ${result.master.name ?? "this project"}.` : undefined,
      });
      void invalidateMapping(queryClient);
    },
    onError: toastAccountError,
  });
}

/** AC10: unlink a member's GitHub account (PM, or the member). */
export function useUnlinkAccount(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => gitIntegrationApi.unlinkAccount(projectId, userId),
    onError: toastAccountError,
    onSettled: () => invalidateMapping(queryClient),
  });
}

/** Moves an e-mail contributor between "unmapped" and a member in the cached overview. */
function moveEmail(view: GitAccountsOverview, contributorId: number, userId: number | null): GitAccountsOverview {
  const fromUnmapped = view.unmapped.find(row => row.contributorId === contributorId);
  const fromMember = view.members.flatMap(member => member.emails.map(email => ({ member, email })))
    .find(entry => entry.email.contributorId === contributorId);
  const email = fromUnmapped?.email ?? fromMember?.email.email ?? null;
  const activity = fromUnmapped?.activity;
  const members = view.members.map(member => {
    let emails = member.emails.filter(row => row.contributorId !== contributorId);
    let memberActivity = member.activity;
    if (member.userId === userId) {
      emails = [...emails, { contributorId, email, mappedByName: null, mappedAt: new Date().toISOString() }];
      if (activity) {
        memberActivity = {
          commits: memberActivity.commits + activity.commits,
          pullRequests: memberActivity.pullRequests + activity.pullRequests,
          reviews: memberActivity.reviews + activity.reviews,
          lastActiveAt: memberActivity.lastActiveAt ?? activity.lastActiveAt,
        };
      }
    }
    return { ...member, emails, activity: memberActivity };
  });
  const unmapped = userId === null || !fromUnmapped
    ? view.unmapped
    : view.unmapped.filter(row => row.contributorId !== contributorId);
  return { ...view, members, unmapped, summary: { ...view.summary, unmappedContributors: unmapped.length } };
}

/** AC11: assign (userId) or unassign (null) an e-mail-only contributor, updated on screen at once. */
export function useAssignContributor(projectId: number) {
  const queryClient = useQueryClient();
  const key = gitIntegrationKeys.githubAccounts(projectId);
  return useMutation({
    mutationFn: ({ contributorId, userId }: { contributorId: number; userId: number | null }) => userId === null
      ? gitIntegrationApi.unassignContributor(projectId, contributorId)
      : gitIntegrationApi.assignContributor(projectId, contributorId, userId),
    onMutate: async ({ contributorId, userId }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<GitAccountsOverview>(key);
      if (previous) queryClient.setQueryData(key, moveEmail(previous, contributorId, userId));
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toastAccountError(error);
    },
    onSettled: () => invalidateMapping(queryClient),
  });
}
