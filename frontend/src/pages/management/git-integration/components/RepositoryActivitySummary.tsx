import { Activity, ChevronRight, GitCommitHorizontal, GitMerge, GitPullRequest, Link2, RefreshCw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import type { GitHubTabTarget } from "../github-tab.params";
import { formatDateTime, formatRelative } from "../git-integration.format";
import { useRepositoryActivity } from "../useGitIntegration";

function Stat({ icon, label, value, hint, onClick }: { icon: ReactNode; label: string; value: ReactNode; hint?: string; onClick?: () => void }) {
  const content = <>
    <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">{icon}{label}</span>
    <span className="mt-1 block truncate text-lg font-semibold tabular-nums leading-6">{value}</span>
  </>;
  if (!onClick) return <div className="min-w-0 rounded-lg border bg-card px-3 py-2.5" title={hint}>{content}</div>;
  return <button type="button" onClick={onClick} title={hint}
    className="min-w-0 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    {content}
  </button>;
}

/**
 * US-SY-04: what the webhooks brought in for the project's repository: counts,
 * the latest commit and how fresh the data is. Refreshes every 30 s while the
 * page is visible; GitHub activity itself is stored within milliseconds.
 * WS-GH-01: tiles and "View activity" open the workspace GitHub tab (`onOpen`).
 */
export function RepositoryActivitySummary({ projectId, repositoryName, onOpen }: {
  projectId: number;
  repositoryName: string;
  onOpen?: (target: GitHubTabTarget) => void;
}) {
  const query = useRepositoryActivity(projectId);
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("GIT_INTEGRATION_MANAGE");
  const data = query.data;
  const open = (target: GitHubTabTarget) => onOpen ? () => onOpen(target) : undefined;

  if (query.isPending) {
    return <div role="status" aria-label="Loading repository activity" className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[0, 1, 2, 3, 4].map(index => <Skeleton key={index} className="h-[62px] rounded-lg" />)}
      </div>
      <Skeleton className="h-10 rounded-lg" />
    </div>;
  }

  if (query.isError || !data) {
    return <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
      Repository activity could not be loaded.
      <Button variant="ghost" size="sm" className="h-7" disabled={query.isFetching} onClick={() => void query.refetch()}>
        <RefreshCw className={query.isFetching ? "animate-spin" : undefined} />Try again
      </Button>
    </div>;
  }

  if (data.repositoryId === null) return null;
  const last = data.lastCommit;
  const empty = data.commitCount === 0 && data.pullRequests.open + data.pullRequests.merged + data.pullRequests.closed === 0;

  return <section aria-label="Repository activity" className="space-y-2">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <Stat icon={<GitCommitHorizontal className="size-3.5" aria-hidden="true" />} label="Commits" value={data.commitCount} onClick={open({ view: "commits" })} />
      <Stat icon={<Link2 className="size-3.5" aria-hidden="true" />} label="Linked to tasks"
        value={data.commitCount > 0 ? `${Math.round((data.linkedCommitCount / data.commitCount) * 100)}%` : <span className="text-sm text-muted-foreground">—</span>}
        hint={`${data.linkedCommitCount} of ${data.commitCount} commits mention a Task ID of this project`}
        onClick={open({ view: "commits", link: "LINKED" })} />
      <Stat icon={<GitPullRequest className="size-3.5" aria-hidden="true" />} label="Open PRs" value={data.pullRequests.open} onClick={open({ view: "pulls", state: "OPEN" })} />
      <Stat icon={<GitMerge className="size-3.5" aria-hidden="true" />} label="Merged PRs" value={data.pullRequests.merged} onClick={open({ view: "pulls", state: "MERGED" })} />
      <Stat icon={<Activity className="size-3.5" aria-hidden="true" />} label="Last activity"
        value={data.lastEventAt ? <span className="text-sm">{formatRelative(data.lastEventAt)}</span> : <span className="text-sm text-muted-foreground">—</span>}
        hint={data.lastEventAt ? `Last GitHub event processed ${formatDateTime(data.lastEventAt)}` : undefined}
        onClick={open({ view: "insights" })} />
    </div>

    {empty ? <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
      No activity yet. Push a commit or open a pull request on <span className="font-medium text-foreground">{repositoryName}</span> and it appears here within seconds.
    </p> : <button type="button" onClick={open({ view: "commits" })} disabled={!onOpen}
      className="group flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left transition-colors enabled:hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {last ? <div className="min-w-0 flex-1">
        <p className="truncate text-xs">
          <span className="mr-1.5 rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-muted-foreground">{last.shortSha}</span>
          <span className="font-medium">{last.headline || "(no message)"}</span>
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {last.authorLogin ?? last.authorName ?? "Unknown author"}
          {last.branch && <> · on <span className="font-mono">{last.branch}</span></>}
          {" · "}<time dateTime={last.committedAt} title={formatDateTime(last.committedAt)}>{formatRelative(last.committedAt)}</time>
        </p>
      </div> : <p className="min-w-0 flex-1 text-xs text-muted-foreground">No commits yet</p>}
      {onOpen && <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground group-hover:text-foreground">
        View activity<ChevronRight className="size-3.5" aria-hidden="true" />
      </span>}
    </button>}

    {(data.failedEvents > 0 || data.pendingEvents > 0) && <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {data.pendingEvents > 0 && <span className="inline-flex items-center gap-1">
        <RefreshCw className="size-3" aria-hidden="true" />{data.pendingEvents} GitHub {data.pendingEvents === 1 ? "event" : "events"} being processed
      </span>}
      {data.failedEvents > 0 && <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
        <TriangleAlert className="size-3" aria-hidden="true" />{data.failedEvents} {data.failedEvents === 1 ? "event" : "events"} could not be synchronized
        {canManage && <Link to="/git-integration#webhook-deliveries" className="font-medium underline underline-offset-2">Review</Link>}
      </span>}
    </p>}

  </section>;
}
