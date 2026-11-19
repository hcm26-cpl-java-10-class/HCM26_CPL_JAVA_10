import { ChevronRight, CircleCheck, Eye, GitCommitHorizontal, GitMerge, GitPullRequest, Link2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { GitRepositoryActivity, GitTaskRef } from "@/types/features/git-integration";
import type { GitHubTabTarget } from "../../github-tab.params";
import { formatDateTime, formatRelative } from "../../git-integration.format";
import { pullRequestsNeedingAttention, STALE_DAYS, type PullRequestAttention } from "../../pull-request-attention";
import { useRepositoryCommits, useRepositoryPullRequests } from "../../useGitIntegration";
import { STAT_TONES } from "../git-integration.styles";
import { CommitRow } from "./CommitList";

/** Open pull requests read to find the ones needing attention (the API's page limit is 100). */
const OPEN_SAMPLE = 50;
const ATTENTION_ROWS = 5;

const ATTENTION: Record<PullRequestAttention, { label: string; dot: string; badge: string }> = {
  CHANGES_REQUESTED: {
    label: "Changes requested",
    dot: "bg-red-500",
    badge: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300",
  },
  AWAITING_REVIEW: {
    label: "Awaiting review",
    dot: "bg-amber-500",
    badge: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  },
  STALE: {
    label: `No update for ${STALE_DAYS}+ days`,
    dot: "bg-slate-400",
    badge: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
};

const PANEL = "min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-card dark:border-border";

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
 * WS-GH-01: what needs attention in the repository at a glance. Every tile and row is a
 * shortcut into the Commits or Pull requests view with the matching filter.
 */
export function RepositoryInsights({ projectId, activity, repositoryName, onNavigate, onOpenTask }: {
  projectId: number;
  activity: GitRepositoryActivity;
  repositoryName: string;
  onNavigate: (target: GitHubTabTarget) => void;
  onOpenTask: (ref: GitTaskRef) => void;
}) {
  const openQuery = useRepositoryPullRequests(projectId, { state: "OPEN", page: 0, size: OPEN_SAMPLE });
  const commitsQuery = useRepositoryCommits(projectId, { page: 0, size: 5 });
  const attention = pullRequestsNeedingAttention(openQuery.data?.items ?? []);
  const awaiting = attention.filter(item => item.reason === "AWAITING_REVIEW").length;
  const sampled = (openQuery.data?.totalElements ?? 0) > OPEN_SAMPLE;
  const { commitCount, linkedCommitCount, pullRequests } = activity;
  const empty = commitCount === 0 && pullRequests.open + pullRequests.merged + pullRequests.closed === 0;

  return <div className="min-w-0 space-y-4">
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      <StatTile icon={<GitCommitHorizontal className="size-3.5" />} tone={STAT_TONES.commit} label="Commits" value={commitCount}
        onClick={() => onNavigate({ view: "commits" })} />
      <StatTile icon={<Link2 className="size-3.5" />} tone={STAT_TONES.linked} label="Linked to tasks"
        value={commitCount > 0 ? `${Math.round((linkedCommitCount / commitCount) * 100)}%` : <span className="text-base text-muted-foreground">—</span>}
        hint={`${linkedCommitCount} of ${commitCount} commits mention a Task ID of this project`}
        onClick={() => onNavigate({ view: "commits", link: "LINKED" })} />
      <StatTile icon={<GitPullRequest className="size-3.5" />} tone={STAT_TONES.open} label="Open PRs" value={pullRequests.open}
        onClick={() => onNavigate({ view: "pulls", state: "OPEN" })} />
      <StatTile icon={<Eye className="size-3.5" />} tone={STAT_TONES.review} label="Awaiting review"
        value={openQuery.isPending ? <span role="status" aria-label="Loading" className="mt-1 inline-block h-5 w-8 animate-pulse rounded-md bg-accent" /> : openQuery.isError ? <span className="text-base text-muted-foreground">—</span> : `${awaiting}${sampled ? "+" : ""}`}
        hint="Open pull requests, not drafts, that nobody has approved or asked to change yet"
        onClick={() => onNavigate({ view: "pulls", state: "OPEN" })} />
      <StatTile icon={<GitMerge className="size-3.5" />} tone={STAT_TONES.merged} label="Merged PRs" value={pullRequests.merged}
        onClick={() => onNavigate({ view: "pulls", state: "MERGED" })} />
    </div>

    {empty ? <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
      No activity yet. Push a commit or open a pull request on <span className="font-medium text-foreground">{repositoryName}</span> and it appears here within seconds.
    </p> : <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
      <section aria-label="Pull requests to act on" className={PANEL}>
        <PanelHeader title="PRs to act on" action={pullRequests.open > 0 && <Button variant="ghost" size="sm" className="h-7 text-xs"
          onClick={() => onNavigate({ view: "pulls", state: "OPEN" })}>All open PRs<ChevronRight /></Button>} />
        {openQuery.isPending ? <div className="space-y-3 p-4">{[0, 1, 2].map(index => <Skeleton key={index} className="h-9 w-full" />)}</div>
          : openQuery.isError ? <PanelError retrying={openQuery.isFetching} onRetry={() => void openQuery.refetch()} />
          : attention.length === 0 ? <p className="flex items-center gap-2 px-4 py-6 text-sm text-emerald-700 dark:text-emerald-300">
            <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
            {pullRequests.open === 0 ? "No open pull requests." : "Nothing waiting — every open pull request has a review."}
          </p>
          : <ul className="divide-y">
            {attention.slice(0, ATTENTION_ROWS).map(({ pr, reason }) => <li key={pr.id}>
              <button type="button" onClick={() => onNavigate({ view: "pulls", state: "OPEN", pr: pr.number })}
                className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", ATTENTION[reason].dot)} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-[13px] font-medium"><span className="text-muted-foreground">#{pr.number}</span> {pr.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                    <span>{pr.authorLogin ?? "Unknown author"}</span>
                    <span>· updated <time dateTime={pr.updatedAt} title={formatDateTime(pr.updatedAt)}>{formatRelative(pr.updatedAt)}</time></span>
                  </span>
                </span>
                <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium", ATTENTION[reason].badge)}>{ATTENTION[reason].label}</span>
              </button>
            </li>)}
            {attention.length > ATTENTION_ROWS && <li className="px-4 py-2 text-[11px] text-muted-foreground">
              +{attention.length - ATTENTION_ROWS} more in <button type="button" className="font-medium text-foreground underline-offset-2 hover:underline"
                onClick={() => onNavigate({ view: "pulls", state: "OPEN" })}>open pull requests</button>
            </li>}
          </ul>}
      </section>

      <section aria-label="Latest commits" className={PANEL}>
        <PanelHeader title="Latest commits" action={commitCount > 0 && <Button variant="ghost" size="sm" className="h-7 text-xs"
          onClick={() => onNavigate({ view: "commits" })}>All commits<ChevronRight /></Button>} />
        {commitsQuery.isPending ? <div className="space-y-3 p-4">{[0, 1, 2].map(index => <Skeleton key={index} className="h-9 w-full" />)}</div>
          : commitsQuery.isError ? <PanelError retrying={commitsQuery.isFetching} onRetry={() => void commitsQuery.refetch()} />
          : (commitsQuery.data?.items.length ?? 0) === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">No commits yet.</p>
          : <ul className="divide-y">
            {commitsQuery.data!.items.map(commit => <CommitRow key={commit.id} commit={commit} compact onOpenTask={onOpenTask}
              onAuthor={author => onNavigate({ view: "commits", author })} />)}
          </ul>}
      </section>
    </div>}
  </div>;
}
