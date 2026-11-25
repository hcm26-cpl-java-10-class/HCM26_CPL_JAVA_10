import { GitCommitHorizontal, GitMerge, GitPullRequest, GitPullRequestClosed } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useBacklogGitLinkSummary } from "@/pages/management/git-integration/useGitIntegration";
import { GitLinkSummaryContext, useGitLinkSummaryOf } from "../git-link-summary";

/** Loads the link counts of every task shown on a board in one request and shares them with the badges. */
export function GitLinkSummaryProvider({ itemIds, children }: { itemIds: number[]; children: ReactNode }) {
  const query = useBacklogGitLinkSummary(itemIds);
  const byId = useMemo(() => new Map((query.data ?? []).map(summary => [summary.itemId, summary])), [query.data]);
  return <GitLinkSummaryContext.Provider value={byId}>{children}</GitLinkSummaryContext.Provider>;
}

const PR_STYLE = {
  OPEN: { icon: GitPullRequest, className: "text-emerald-600 dark:text-emerald-400", label: "open" },
  MERGED: { icon: GitMerge, className: "text-violet-600 dark:text-violet-400", label: "merged" },
  CLOSED: { icon: GitPullRequestClosed, className: "text-red-600 dark:text-red-400", label: "closed" },
} as const;

/**
 * US-SY-05: commits and latest pull request of a task, at a glance on Backlog and Kanban.
 * Shows nothing while the task has no linked commit, so cards stay clean.
 */
export function GitLinkBadge({ itemId, className }: { itemId: number; className?: string }) {
  const summary = useGitLinkSummaryOf(itemId);
  if (!summary || (summary.commitCount === 0 && summary.pullRequestCount === 0)) return null;
  const pr = summary.latestPullRequestState ? PR_STYLE[summary.latestPullRequestState] : null;
  const label = [
    `${summary.commitCount} ${summary.commitCount === 1 ? "commit" : "commits"}`,
    pr && summary.latestPullRequestNumber != null ? `pull request #${summary.latestPullRequestNumber} ${pr.label}` : null,
  ].filter(Boolean).join(" · ");
  const PrIcon = pr?.icon;
  return <span title={label} aria-label={label}
    className={cn("inline-flex shrink-0 items-center gap-1 text-[11px] font-medium tabular-nums text-muted-foreground", className)}>
    {summary.commitCount > 0 && <><GitCommitHorizontal className="size-3.5" aria-hidden="true" />{summary.commitCount}</>}
    {PrIcon && <PrIcon className={cn("size-3.5", pr.className)} aria-hidden="true" />}
  </span>;
}
