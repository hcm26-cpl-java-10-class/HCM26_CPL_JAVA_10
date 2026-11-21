import { GitCommitHorizontal, GitPullRequest, LayoutDashboard, RefreshCw, TriangleAlert, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { usePermissions } from "@/hooks/usePermissions";
import type { GitRepositoryActivity, GitTaskRef } from "@/types/features/git-integration";
import {
  clearGitHubTabParams, openGitHubTabParams, parseGitHubTabParams, patchGitHubTabParams,
  type GitHubTabPatch, type GitHubTabTarget, type GitHubView,
} from "@/pages/management/git-integration/github-tab.params";
import { useGitHubAccounts, useProjectRepository, useRepositoryActivity } from "@/pages/management/git-integration/useGitIntegration";
import { ConnectAccountBanner, ConnectAccountButton } from "@/pages/management/git-integration/components/members/ConnectAccountBanner";
import { GitHubAccountChip } from "@/pages/management/git-integration/components/members/GitHubAccountChip";
import { MembersView } from "@/pages/management/git-integration/components/members/MembersView";
import { ProjectRepositoryCard } from "@/pages/management/git-integration/components/ProjectRepositoryCard";
import { Segmented } from "@/pages/management/git-integration/components/activity/ActivityControls";
import { CommitList } from "@/pages/management/git-integration/components/activity/CommitList";
import { PullRequestsView } from "@/pages/management/git-integration/components/activity/PullRequestList";
import { RepositoryInsights } from "@/pages/management/git-integration/components/activity/RepositoryInsights";
import { Skeleton } from "@/components/ui/skeleton";
import { isConnectBannerSnoozed, snoozeConnectBanner } from "@/pages/management/git-integration/git-integration.storage";

const CARD = "min-w-0 gap-0 overflow-hidden border-slate-200/80 py-0 shadow-none dark:border-border";
// `overflow-clip` keeps the rounded corners without becoming a scroll container, so sticky day headers still stick.
const LIST_CARD = "min-w-0 overflow-clip rounded-xl border border-slate-200/80 bg-card dark:border-border";

function Count({ value }: { value?: number }) {
  if (value === undefined) return null;
  return <span className="rounded-full bg-current/15 px-1.5 text-[10px] font-semibold tabular-nums leading-4">{value}</span>;
}

function SyncHealth({ activity }: { activity: GitRepositoryActivity }) {
  const { hasPermission } = usePermissions();
  if (activity.pendingEvents === 0 && activity.failedEvents === 0) return null;
  return <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
    {activity.pendingEvents > 0 && <span className="inline-flex items-center gap-1">
      <RefreshCw className="size-3" aria-hidden="true" />{activity.pendingEvents} GitHub {activity.pendingEvents === 1 ? "event" : "events"} being processed
    </span>}
    {activity.failedEvents > 0 && <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
      <TriangleAlert className="size-3" aria-hidden="true" />{activity.failedEvents} {activity.failedEvents === 1 ? "event" : "events"} could not be synchronized
      {hasPermission("GIT_INTEGRATION_MANAGE") && <Link to="/git-integration#webhook-deliveries" className="font-medium underline underline-offset-2">Review</Link>}
    </span>}
  </p>;
}

/**
 * WS-GH-01: GitHub tab of a workspace (`?tab=github`). The repository card on top
 * (link, sync state, alerts) followed by Insights, Commits and Pull requests of the
 * project's repository — a module reads its master's. All state lives in the URL.
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
  const activity = useRepositoryActivity(projectId, linked);
  // US-GI-06: one request feeds the Connect banner, the Members view and its count.
  const accounts = useGitHubAccounts(projectId, linked);
  const overview = accounts.data;
  // "Not now" hides the banner for a week (per master); the strip then offers a compact button.
  const [snoozedNow, setSnoozedNow] = useState(false);
  const canConnect = !!overview && overview.viewer.canConnect && !overview.viewer.mapped;
  // Members offers Connect on the viewer's own row, so neither the banner nor the strip button shows there.
  const inMembers = state.view === "members";
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
  ];

  let content: ReactNode = null;
  if (linked) {
    if (state.view === "commits") {
      content = <div className={LIST_CARD}><CommitList projectId={projectId} filters={state} onChange={update} onOpenTask={openTask} /></div>;
    } else if (state.view === "members") {
      content = <MembersView projectId={projectId} overview={overview} loading={accounts.isPending} error={accounts.isError}
        onRetry={() => void accounts.refetch()} highlight={state.contributor} />;
    } else if (state.view === "pulls") {
      content = <div className={LIST_CARD}><PullRequestsView projectId={projectId} filters={state} onChange={update} onOpenTask={openTask} /></div>;
    } else if (activity.isPending) {
      content = <div role="status" aria-label="Loading insights" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map(index => <Skeleton key={index} className="h-[78px] rounded-xl" />)}
      </div>;
    } else if (activity.isError || !data) {
      content = <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
        Repository activity could not be loaded.
        <button type="button" className="font-medium text-foreground underline-offset-2 hover:underline" onClick={() => void activity.refetch()}>Try again</button>
      </div>;
    } else {
      content = <RepositoryInsights projectId={projectId} activity={data} repositoryName={repository.data!.repository!.fullName}
        defaultBranch={repository.data!.repository!.defaultBranch} range={state.range}
        onRange={range => update({ range })} onNavigate={navigate} onOpenTask={openTask} />;
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
    {linked && <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented label="GitHub views" value={state.view} options={views}
          onChange={view => navigate({ view, range: state.range })} />
        {data && <SyncHealth activity={data} />}
      </div>
      {content}
    </>}
  </div>;
}
