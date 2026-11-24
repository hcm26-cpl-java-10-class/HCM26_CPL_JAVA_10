import { GitCommitHorizontal, GitPullRequest, History, LayoutDashboard, Loader2, RefreshCw, TriangleAlert, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { usePermissions } from "@/hooks/usePermissions";
import type { GitRepositoryActivity, GitTaskRef } from "@/types/features/git-integration";
import {
  clearGitHubTabParams, openGitHubTabParams, parseGitHubTabParams, patchGitHubTabParams, periodOf,
  type GitHubTabPatch, type GitHubTabTarget, type GitHubView,
} from "@/pages/management/git-integration/github-tab.params";
import { syncInProgress, useGitHubAccounts, useProjectRepository, useRepositoryActivity } from "@/pages/management/git-integration/useGitIntegration";
import { ConnectAccountBanner, ConnectAccountButton } from "@/pages/management/git-integration/components/members/ConnectAccountBanner";
import { GitHubAccountChip } from "@/pages/management/git-integration/components/members/GitHubAccountChip";
import { MembersView } from "@/pages/management/git-integration/components/members/MembersView";
import { ProjectRepositoryCard } from "@/pages/management/git-integration/components/ProjectRepositoryCard";
import { Segmented } from "@/pages/management/git-integration/components/activity/ActivityControls";
import { CommitList } from "@/pages/management/git-integration/components/activity/CommitList";
import { PullRequestsView } from "@/pages/management/git-integration/components/activity/PullRequestList";
import { RepositoryInsights } from "@/pages/management/git-integration/components/activity/RepositoryInsights";
import { SyncHistoryView } from "@/pages/management/git-integration/components/sync-history/SyncHistoryView";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isConnectBannerSnoozed, snoozeConnectBanner } from "@/pages/management/git-integration/git-integration.storage";

const CARD = "min-w-0 gap-0 overflow-hidden border-slate-200/80 py-0 shadow-none dark:border-border";
// `overflow-clip` keeps the rounded corners without becoming a scroll container, so sticky day headers still stick.
const LIST_CARD = "min-w-0 overflow-clip rounded-xl border border-slate-200/80 bg-card dark:border-border";

function Count({ value }: { value?: number }) {
  if (value === undefined) return null;
  return <span className="rounded-full bg-current/15 px-1.5 text-[10px] font-semibold tabular-nums leading-4">{value}</span>;
}

function SyncHealth({ activity, onReview }: { activity: GitRepositoryActivity; onReview?: () => void }) {
  const { hasPermission } = usePermissions();
  if (activity.pendingEvents === 0 && activity.failedEvents === 0) return null;
  return <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
    {activity.pendingEvents > 0 && <span className="inline-flex items-center gap-1">
      <RefreshCw className="size-3" aria-hidden="true" />{activity.pendingEvents} GitHub {activity.pendingEvents === 1 ? "event" : "events"} being processed
    </span>}
    {activity.failedEvents > 0 && <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
      <TriangleAlert className="size-3" aria-hidden="true" />{activity.failedEvents} {activity.failedEvents === 1 ? "event" : "events"} could not be synchronized
      {onReview
        // US-SY-06: the PM reviews (and retries) them in the project's Sync history.
        ? <button type="button" onClick={onReview} className="font-medium underline underline-offset-2">Review</button>
        : hasPermission("GIT_INTEGRATION_MANAGE") && <Link to="/git-integration#webhook-deliveries" className="font-medium underline underline-offset-2">Review</Link>}
    </span>}
  </p>;
}

/** US-SY-01 AC03: no commit yet, either because the history is still being imported or the repository is empty. */
function EmptyHistory({ importing, branch }: { importing: boolean; branch?: string | null }) {
  return <div role="status" className="flex items-start gap-3 rounded-xl border border-dashed border-slate-300 bg-card px-4 py-5 dark:border-border">
    <span aria-hidden="true" className={importing
      ? "flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-300"
      : "flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"}>
      {importing ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <GitCommitHorizontal className="size-4" />}
    </span>
    <div className="min-w-0 space-y-0.5">
      <p className="text-sm font-medium">{importing ? "Importing the commit history…" : "This repository has no commits yet"}</p>
      <p className="text-xs text-muted-foreground">
        {importing ? "Commits appear here as soon as they are imported. You can keep working meanwhile."
          : <>Commits pushed to <span className="font-mono text-foreground">{branch ?? "the default branch"}</span> will appear here automatically.</>}
      </p>
    </div>
  </div>;
}

/** US-GI-05: narrows Insights, Commits and Pull requests to one repository when the project linked several. */
function RepositoryFilter({ activity, value, onChange }: {
  activity: GitRepositoryActivity;
  value?: number;
  onChange: (repo: number | undefined) => void;
}) {
  const repositories = activity.repositories ?? [];
  if (repositories.length < 2) return null;
  return <Select value={value === undefined ? "all" : String(value)} onValueChange={next => onChange(next === "all" ? undefined : Number(next))}>
    <SelectTrigger size="sm" aria-label="Repository" className="h-8 max-w-64 text-xs">
      <SelectValue />
    </SelectTrigger>
    <SelectContent align="end">
      <SelectItem value="all">All repositories</SelectItem>
      {repositories.map(repository => <SelectItem key={repository.id} value={String(repository.id)}>
        {repository.fullName}{repository.status === "INACTIVE" ? " (unlinked)" : repository.status === "DISCONNECTED" ? " (disconnected)" : ""}
      </SelectItem>)}
    </SelectContent>
  </Select>;
}

/**
 * WS-GH-01: GitHub tab of a workspace (`?tab=github`). The repository card on top
 * (link, sync state, alerts) followed by Insights, Commits and Pull requests of the
 * project's repository — a module reads its master's. All state lives in the URL.
 * US-GI-05: the views cover every repository the project linked (unlinked ones included, labelled),
 * so they stay available after an unlink; `repo` narrows them to one.
 */
export function WorkspaceGitHubPanel({ projectId, assignedProjectIds }: {
  projectId: number;
  /** Projects of this workspace the viewer may open; a task of another project is not navigated to. */
  assignedProjectIds: number[];
}) {
  const [params, setParams] = useSearchParams();
  const state = parseGitHubTabParams(params);
  const repository = useProjectRepository(projectId);
  const linked = !!repository.data?.repository;
  // US-GI-05: the data of unlinked repositories stays visible.
  const hasData = linked || (repository.data?.previousRepositories?.length ?? 0) > 0;
  const activity = useRepositoryActivity(projectId, hasData);
  // US-GI-06: one request feeds the Connect banner, the Members view and its count.
  const accounts = useGitHubAccounts(projectId, linked);
  const overview = accounts.data;
  // "Not now" hides the banner for a week (per master); the strip then offers a compact button.
  const [snoozedNow, setSnoozedNow] = useState(false);
  const canConnect = !!overview && overview.viewer.canConnect && !overview.viewer.mapped;
  // Members offers Connect on the viewer's own row, so neither the banner nor the strip button shows there.
  const inMembers = state.view === "members";
  // US-SY-06: Sync history, for whoever manages the project (it picks one repository itself).
  const canViewHistory = !!repository.data?.canViewSyncHistory;
  const inHistory = state.view === "history";
  const showBanner = linked && canConnect && !inMembers && !snoozedNow && !isConnectBannerSnoozed(overview!.master.id);

  // Filters replace the history entry; opening a task pushes one so Back returns here.
  const update = (patch: GitHubTabPatch) => setParams(previous => patchGitHubTabParams(previous, patch), { replace: true });
  const navigate = (target: GitHubTabTarget) => setParams(previous => openGitHubTabParams(previous, target), { replace: true });
  // WS-GH-02: a module's task opens in that module's Backlog (when the viewer is assigned to it).
  const openTask = (ref: GitTaskRef) => {
    if (ref.itemId == null) return;
    const target = ref.itemProjectId ?? projectId;
    if (target !== projectId && !assignedProjectIds.includes(target)) {
      toast.info("This task belongs to a project you are not assigned to.");
      return;
    }
    setParams(previous => {
      const next = clearGitHubTabParams(previous);
      next.set("tab", "backlog");
      next.set("itemId", String(ref.itemId));
      if (target !== projectId) next.set("project", String(target));
      return next;
    });
  };

  const data = activity.data;
  const views: Array<{ id: GitHubView; label: ReactNode }> = [
    { id: "insights", label: <><LayoutDashboard className="size-3.5" aria-hidden="true" />Insights</> },
    { id: "commits", label: <><GitCommitHorizontal className="size-3.5" aria-hidden="true" />Commits<Count value={data?.commitCount} /></> },
    { id: "pulls", label: <><GitPullRequest className="size-3.5" aria-hidden="true" />Pull requests<Count value={data?.pullRequests.open} /></> },
    { id: "members", label: <><Users className="size-3.5" aria-hidden="true" />Members
      {overview && overview.summary.unmappedContributors > 0 && <span title={`${overview.summary.unmappedContributors} unmapped contributors`}
        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold tabular-nums leading-4 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />{overview.summary.unmappedContributors}
      </span>}</> },
    ...(canViewHistory ? [{ id: "history" as const, label: <><History className="size-3.5" aria-hidden="true" />Sync history</> }] : []),
  ];

  // Shown on Insights when nothing is linked now (only unlinked repositories).
  const repositoryName = repository.data?.repository?.fullName ?? repository.data?.previousRepositories?.[0]?.fullName ?? "the repository";
  // Sync history reads one repository: the one in the URL is checked by the server (404 when not the project's).
  const repo = inHistory ? state.repo : data?.repositories?.some(item => item.id === state.repo) ? state.repo : undefined;
  const filters = { ...state, repo };

  let content: ReactNode = null;
  if (hasData) {
    if (inHistory) {
      content = canViewHistory
        ? <div className={LIST_CARD}><SyncHistoryView projectId={projectId} state={filters} onChange={update} canLink={!!repository.data?.canLink} /></div>
        : <div role="status" className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Only the project manager can view the synchronization history.
        </div>;
    } else if (state.view === "commits") {
      content = <div className={LIST_CARD}><CommitList projectId={projectId} filters={filters} onChange={update} onOpenTask={openTask} /></div>;
    } else if (state.view === "members") {
      content = <MembersView projectId={projectId} overview={overview} loading={accounts.isPending} error={accounts.isError}
        onRetry={() => void accounts.refetch()} highlight={state.contributor} />;
    } else if (state.view === "pulls") {
      content = <div className={LIST_CARD}><PullRequestsView projectId={projectId} filters={filters} onChange={update} onOpenTask={openTask} /></div>;
    } else if (activity.isPending) {
      content = <div role="status" aria-label="Loading insights" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map(index => <Skeleton key={index} className="h-[78px] rounded-xl" />)}
      </div>;
    } else if (activity.isError || !data) {
      content = <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
        Repository activity could not be loaded.
        <button type="button" className="font-medium text-foreground underline-offset-2 hover:underline" onClick={() => void activity.refetch()}>Try again</button>
      </div>;
    } else if (data.commitCount === 0 && (syncInProgress(repository.data)
      || (repository.data?.latestSync?.status === "SUCCEEDED" && repository.data.latestSync.stats.emptyRepository === true))) {
      content = <EmptyHistory importing={syncInProgress(repository.data)} branch={repository.data?.repository?.defaultBranch} />;
    } else {
      content = <RepositoryInsights projectId={projectId} activity={data} repositoryName={repositoryName} repositoryId={repo}
        defaultBranch={repository.data?.repository?.defaultBranch} period={periodOf(state)}
        onPeriod={period => update({ range: period.range, since: period.since, until: period.until })} onNavigate={navigate} onOpenTask={openTask} />;
    }
  }

  return <div className="min-w-0 space-y-4">
    <Card className={CARD}>
      <ProjectRepositoryCard projectId={projectId} showActivity={false} variant="strip"
        extra={overview && (overview.viewer.mapped
          ? <GitHubAccountChip login={overview.members.find(m => m.userId === overview.viewer.userId)?.github?.login ?? overview.viewer.identity?.login ?? null}
            title={`You are connected · applies to ${overview.master.name ?? "the project"} and all its modules`} />
          // US-GI-06: still one click away after "Not now" hid the banner.
          : canConnect && !showBanner && !inMembers && <ConnectAccountButton projectId={projectId} login={overview.viewer.identity?.login} variant="outline" />)} />
    </Card>
    {showBanner && <ConnectAccountBanner projectId={projectId} overview={overview!}
      onSnooze={() => { snoozeConnectBanner(overview!.master.id); setSnoozedNow(true); }} />}
    {hasData && <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented label="GitHub views" value={state.view} options={views}
          onChange={view => navigate({ view, ...periodOf(state), repo: view === "history" || inHistory ? undefined : repo })} />
        <div className="flex flex-wrap items-center gap-2">
          {data && !inMembers && !inHistory && <RepositoryFilter activity={data} value={repo} onChange={next => update({ repo: next, pr: undefined })} />}
          {data && linked && !inHistory && <SyncHealth activity={data}
            onReview={canViewHistory ? () => navigate({ view: "history", status: "FAILED" }) : undefined} />}
        </div>
      </div>
      {content}
    </>}
  </div>;
}
