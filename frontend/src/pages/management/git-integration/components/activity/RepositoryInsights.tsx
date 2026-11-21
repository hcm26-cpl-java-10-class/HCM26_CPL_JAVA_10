import { ChevronRight, CircleCheck, Eye, GitCommitHorizontal, GitMerge, GitPullRequest, Link2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { GitInsightsRange, GitPullRequestAttention, GitRepositoryActivity, GitTaskRef } from "@/types/features/git-integration";
import type { GitHubTabTarget } from "../../github-tab.params";
import { formatDateTime, formatRelative } from "../../git-integration.format";
import { useGitHubAccounts, useRepositoryCommits, useRepositoryInsights, useRepositoryPullRequests } from "../../useGitIntegration";
import { pullRequestAccent, STAT_TONES } from "../git-integration.styles";
import { ActivitySection } from "./ActivitySection";
import { CommitRow } from "./CommitList";

const ATTENTION: Record<GitPullRequestAttention, { label: (staleDays: number) => string; dot: string; badge: string }> = {
  CHANGES_REQUESTED: {
    label: () => "Changes requested",
    dot: "bg-red-500",
    badge: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300",
  },
  AWAITING_REVIEW: {
    label: () => "Awaiting review",
    dot: "bg-amber-500",
    badge: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  },
  STALE: {
    label: days => `No update for ${days}+ days`,
    dot: "bg-slate-400",
    badge: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
};

const PANEL = "flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-card dark:border-border";
const RECENT_MERGED = 3;
/** "Recently merged" fills the panel while fewer pull requests than this need attention. */
const RECENT_WHEN_FEWER_THAN = 3;
/** Temporarily hidden; flip back to true to show the "Awaiting review" stat tile again. */
const SHOW_AWAITING_REVIEW_TILE = false;

function StatTile({ icon, tone, label, value, hint, onClick }: {
  icon: ReactNode;
  tone: string;
  label: string;
  value: ReactNode;
  hint?: string;
  onClick: () => void;
}) {
  return <button type="button" onClick={onClick} title={hint}
    className="group min-w-0 rounded-xl border border-slate-200/80 bg-card px-3.5 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-border dark:hover:bg-muted/30">
    <span className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-muted-foreground">
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", tone)} aria-hidden="true">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" aria-hidden="true" />
    </span>
    <span className="mt-2 block truncate text-xl font-semibold tabular-nums leading-7">{value}</span>
  </button>;
}

function PanelHeader({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="flex items-center justify-between gap-2 border-b bg-slate-50/40 px-4 py-2.5 dark:bg-muted/20">
    <h3 className="text-sm font-semibold">{title}</h3>
    {action}
  </div>;
}

function PanelError({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return <div role="alert" className="flex items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground">
    Could not be loaded.
    <Button variant="ghost" size="sm" className="h-7" disabled={retrying} onClick={onRetry}><RefreshCw className={retrying ? "animate-spin" : undefined} />Try again</Button>
  </div>;
}

/**
 * WS-GH-01/02: the repository at a glance. Top: the current state (tiles, pull requests to
 * act on, latest commits). Below: the activity of the chosen period. Every tile and row is
 * a shortcut into the Commits or Pull requests view with the matching filter.
 */
export function RepositoryInsights({ projectId, activity, repositoryName, defaultBranch, range, onRange, onNavigate, onOpenTask }: {
  projectId: number;
  activity: GitRepositoryActivity;
  repositoryName: string;
  defaultBranch?: string | null;
  range: GitInsightsRange;
  onRange: (range: GitInsightsRange) => void;
  onNavigate: (target: GitHubTabTarget) => void;
  onOpenTask: (ref: GitTaskRef) => void;
}) {
  const insights = useRepositoryInsights(projectId, range);
  const accounts = useGitHubAccounts(projectId);
  const commitsQuery = useRepositoryCommits(projectId, { page: 0, size: 5 });
  const health = insights.data?.pullRequests;
  // Nothing to act on: the panel shows the latest merges instead of an empty block.
  const calm = !!health && health.attention.length === 0;
  const showRecent = !!health && health.attention.length < RECENT_WHEN_FEWER_THAN;
  const merged = useRepositoryPullRequests(projectId, { state: "MERGED", page: 0, size: RECENT_MERGED }, showRecent);
  const { commitCount, linkedCommitCount, pullRequests } = activity;
  const empty = commitCount === 0 && pullRequests.open + pullRequests.merged + pullRequests.closed === 0;
  const go = (target: GitHubTabTarget) => onNavigate({ ...target, range });

  return <div className="min-w-0 space-y-4">
    <div className={cn("grid grid-cols-2 gap-2.5 sm:grid-cols-3", SHOW_AWAITING_REVIEW_TILE ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
      <StatTile icon={<GitCommitHorizontal className="size-3.5" />} tone={STAT_TONES.commit} label="Commits" value={commitCount}
        onClick={() => go({ view: "commits" })} />
      <StatTile icon={<Link2 className="size-3.5" />} tone={STAT_TONES.linked} label="Linked to tasks"
        value={commitCount > 0 ? `${Math.round((linkedCommitCount / commitCount) * 100)}%` : <span className="text-base text-muted-foreground">—</span>}
        hint={`${linkedCommitCount} of ${commitCount} commits mention a Task ID of this project`}
        onClick={() => go({ view: "commits", link: "LINKED" })} />
      <StatTile icon={<GitPullRequest className="size-3.5" />} tone={STAT_TONES.open} label="Open PRs" value={pullRequests.open}
        onClick={() => go({ view: "pulls", state: "OPEN" })} />
      {SHOW_AWAITING_REVIEW_TILE && <StatTile icon={<Eye className="size-3.5" />} tone={STAT_TONES.review} label="Awaiting review"
        value={insights.isPending ? <span role="status" aria-label="Loading" className="mt-1 inline-block h-5 w-8 animate-pulse rounded-md bg-accent" />
          : health ? health.awaitingReview : <span className="text-base text-muted-foreground">—</span>}
        hint="Open pull requests, not drafts, that nobody has approved or asked to change yet"
        onClick={() => go({ view: "pulls", state: "OPEN" })} />}
      <StatTile icon={<GitMerge className="size-3.5" />} tone={STAT_TONES.merged} label="Merged PRs" value={pullRequests.merged}
        onClick={() => go({ view: "pulls", state: "MERGED" })} />
    </div>

    {empty ? <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
      No activity yet. Push a commit or open a pull request on <span className="font-medium text-foreground">{repositoryName}</span> and it appears here within seconds.
    </p> : <>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <section aria-label="Pull requests to act on" className={PANEL}>
          <PanelHeader title={calm ? "Pull requests" : "PRs to act on"} action={pullRequests.open > 0 && <Button variant="ghost" size="sm" className="h-7 text-xs"
            onClick={() => go({ view: "pulls", state: "OPEN" })}>All open PRs<ChevronRight /></Button>} />
          {insights.isPending ? <div className="space-y-3 p-4">{[0, 1, 2].map(index => <Skeleton key={index} className="h-9 w-full" />)}</div>
            : insights.isError || !health ? <PanelError retrying={insights.isFetching} onRetry={() => void insights.refetch()} />
            : <div className="flex flex-1 flex-col">
              {calm && <p className="flex items-center gap-2 border-b bg-emerald-50/50 px-4 py-2.5 text-[13px] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
                <span><span className="font-medium">Nothing to review</span> — {health.open === 0 ? "no open pull requests." : "every open pull request has a review."}</span>
              </p>}
              {!calm && <ul className={cn("divide-y", showRecent && "border-b")}>
                {health.attention.map(({ pullRequest: pr, reason }) => <li key={pr.id}>
                  <button type="button" onClick={() => go({ view: "pulls", state: "OPEN", pr: pr.number })}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", ATTENTION[reason].dot)} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-[13px] font-medium"><span className="text-muted-foreground">#{pr.number}</span> {pr.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                        <span>{pr.authorLogin ?? "Unknown author"}</span>
                        <span>· updated <time dateTime={pr.updatedAt} title={formatDateTime(pr.updatedAt)}>{formatRelative(pr.updatedAt)}</time></span>
                      </span>
                    </span>
                    <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium", ATTENTION[reason].badge)}>{ATTENTION[reason].label(health.staleDays)}</span>
                  </button>
                </li>)}
                {health.awaitingReview + health.changesRequested + health.stale > health.attention.length && <li className="px-4 py-2 text-[11px] text-muted-foreground">
                  +{health.awaitingReview + health.changesRequested + health.stale - health.attention.length} more in <button type="button"
                    className="font-medium text-foreground underline-offset-2 hover:underline" onClick={() => go({ view: "pulls", state: "OPEN" })}>open pull requests</button>
                </li>}
              </ul>}
              {/* Few or no PRs to act on: the latest merges fill the panel with something useful. */}
              {showRecent && <>
                <h4 className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recently merged</h4>
                {merged.isPending ? <div className="space-y-2 px-4 pb-3">{[0, 1].map(index => <Skeleton key={index} className="h-8 w-full" />)}</div>
                  : merged.isError ? <PanelError retrying={merged.isFetching} onRetry={() => void merged.refetch()} />
                  : (merged.data?.items.length ?? 0) === 0 ? <p className="px-4 pb-4 text-xs text-muted-foreground">No pull request has been merged yet.</p>
                  : <ul className="pb-1">
                    {merged.data!.items.map(pr => <li key={pr.id}>
                      <button type="button" onClick={() => go({ view: "pulls", state: "MERGED", pr: pr.number })}
                        className={cn("flex w-full items-start gap-2.5 py-2 pl-[14px] pr-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", pullRequestAccent(pr.state, pr.draft))}>
                        <GitMerge className="mt-0.5 size-3.5 shrink-0 text-violet-500 dark:text-violet-400" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-1 text-[13px] font-medium"><span className="text-muted-foreground">#{pr.number}</span> {pr.title}</span>
                          <span className="text-[11px] text-muted-foreground">{pr.authorLogin ?? "Unknown author"}
                            {pr.mergedAt && <> · merged <time dateTime={pr.mergedAt} title={formatDateTime(pr.mergedAt)}>{formatRelative(pr.mergedAt)}</time></>}
                          </span>
                        </span>
                      </button>
                    </li>)}
                  </ul>}
                {pullRequests.merged > RECENT_MERGED && <button type="button" onClick={() => go({ view: "pulls", state: "MERGED" })}
                  className="mt-auto border-t px-4 py-2 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground">
                  All {pullRequests.merged} merged pull requests →
                </button>}
              </>}
            </div>}
        </section>

        <section aria-label="Latest commits" className={PANEL}>
          <PanelHeader title="Latest commits" action={commitCount > 0 && <Button variant="ghost" size="sm" className="h-7 text-xs"
            onClick={() => go({ view: "commits" })}>All commits<ChevronRight /></Button>} />
          {commitsQuery.isPending ? <div className="space-y-3 p-4">{[0, 1, 2].map(index => <Skeleton key={index} className="h-9 w-full" />)}</div>
            : commitsQuery.isError ? <PanelError retrying={commitsQuery.isFetching} onRetry={() => void commitsQuery.refetch()} />
            : (commitsQuery.data?.items.length ?? 0) === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">No commits yet.</p>
            : <ul className="divide-y">
              {commitsQuery.data!.items.map(commit => <CommitRow key={commit.id} commit={commit} compact onOpenTask={onOpenTask}
                onAuthor={author => go({ view: "commits", author })} />)}
            </ul>}
        </section>
      </div>

      <ActivitySection query={insights} range={range} onRange={onRange} defaultBranch={defaultBranch} onNavigate={onNavigate}
        canManageAccounts={accounts.data?.viewer.canManage ?? false} />
    </>}
  </div>;
}
