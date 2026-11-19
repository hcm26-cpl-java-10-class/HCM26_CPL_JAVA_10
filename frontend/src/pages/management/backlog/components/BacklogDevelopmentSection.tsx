import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { useBacklogGitLinks, usePinGitLink, useUnlinkGitLink } from "@/pages/management/git-integration/useGitIntegration";
import { CommitRow, CopyButtons, CopyMenu, DevelopmentError, PullRequestRow } from "./BacklogDevelopmentParts";
import { plural, rankPullRequests, type DevelopmentTab } from "./development.utils";
import { LinkPullRequestPopover } from "./LinkPullRequestPopover";

/** Rows the preview shows at most, so a busy task does not push the rest of the panel down. */
const PREVIEW_ROWS = 3;

/**
 * US-SY-05 / US-TM-03 Task Detail: the pull requests and commits that name this task's Task ID,
 * linked automatically as GitHub sends them (no "sync" button), plus pull requests linked by hand.
 * A preview of fixed height: the pull requests that need attention first, then the latest
 * commits, and a line that opens the full lists (`onViewAll`). Refreshes every 30 s while open.
 */
export function BacklogDevelopmentSection({ itemId, taskKey, title, onViewAll }: {
  itemId: number;
  taskKey?: string | null;
  title?: string | null;
  onViewAll: (tab: DevelopmentTab) => void;
}) {
  const query = useBacklogGitLinks(itemId);
  const data = query.data;
  const key = data?.taskKey ?? taskKey ?? null;
  const total = (data?.commitCount ?? 0) + (data?.pullRequestCount ?? 0);
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("SPRINT_BACKLOG_UPDATE");
  const canLink = canEdit && !!data?.repository;
  const pin = usePinGitLink(itemId);
  const unlink = useUnlinkGitLink(itemId, key);

  let body: ReactNode;
  if (query.isPending) {
    body = <div role="status" aria-label="Loading linked commits" className="space-y-2 rounded-lg border p-3">
      <Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/2" />
    </div>;
  } else if (query.isError) {
    body = <DevelopmentError retrying={query.isFetching} onRetry={() => void query.refetch()} />;
  } else if (data && total === 0) {
    body = <div className="space-y-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">
        {key
          ? <>Put <span className="font-mono font-medium text-foreground">{key}</span> in a commit message or pull request and it is linked here within seconds.
            {canLink && <> Already opened one? <LinkPullRequestPopover itemId={itemId} taskKey={key} trigger="link" /></>}</>
          : "This work item has no Task ID yet."}
      </p>
      {key && <CopyButtons taskKey={key} title={title} />}
      {!data.repository && <p className="text-[11px] text-muted-foreground">The project has no linked repository yet.</p>}
    </div>;
  } else if (data) {
    const pullRequests = rankPullRequests(data.pullRequests).slice(0, PREVIEW_ROWS);
    const commits = data.commits.items.slice(0, PREVIEW_ROWS - pullRequests.length);
    const morePullRequests = data.pullRequestCount - pullRequests.length;
    const moreCommits = data.commitCount - commits.length;
    const footer: Array<{ tab: DevelopmentTab; label: string }> = [];
    if (morePullRequests > 0) footer.push({ tab: "pulls", label: `+${plural(morePullRequests, "pull request")}` });
    if (moreCommits > 0) footer.push({ tab: "commits", label: commits.length > 0 ? `+${plural(moreCommits, "commit")}` : plural(moreCommits, "commit") });

    body = <div className={cn("overflow-hidden rounded-lg border bg-card transition-opacity", query.isFetching && "opacity-80")}>
      {pullRequests.length > 0 && <ul aria-label="Pull requests needing attention first" className="divide-y">
        {pullRequests.map(row => <PullRequestRow key={row.link.id} row={row} taskKey={key} canEdit={canEdit} compact
          onPin={() => pin.mutate(row.link.id)}
          onUnlink={() => unlink.mutate({ linkId: row.link.id, number: row.pullRequest.number })} />)}
      </ul>}
      {commits.length > 0 && <ul aria-label="Latest commits" className={cn("divide-y", pullRequests.length > 0 && "border-t")}>
        {commits.map(commit => <CommitRow key={commit.id} commit={commit} />)}
      </ul>}
      {footer.length > 0 && <footer className="flex items-center gap-1 border-t bg-muted/30 px-1.5 py-1 text-[11px] text-muted-foreground">
        {footer.map((part, index) => <span key={part.tab} className="flex items-center gap-1">
          {index > 0 && <span aria-hidden="true">·</span>}
          <button type="button" onClick={() => onViewAll(part.tab)}
            className="rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {part.label}
          </button>
        </span>)}
        <button type="button" onClick={() => onViewAll(morePullRequests > 0 ? "pulls" : "commits")}
          className="ml-auto inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-medium text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          View all<ChevronRight className="size-3.5" aria-hidden="true" />
        </button>
      </footer>}
    </div>;
  }

  return <section aria-labelledby={`development-${itemId}`} className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <h3 id={`development-${itemId}`} className="flex items-baseline gap-1.5 text-sm font-semibold text-foreground">
        Development
        {data && total > 0 && <span className="text-xs font-normal text-muted-foreground">
          {data.pullRequestCount > 0 && <>{plural(data.pullRequestCount, "pull request")} · </>}{plural(data.commitCount, "commit")}
        </span>}
      </h3>
      <div className="flex items-center gap-1">
        {canLink && total > 0 && <LinkPullRequestPopover itemId={itemId} taskKey={key} />}
        {key && data && total > 0 && <CopyMenu taskKey={key} title={title} />}
      </div>
    </div>
    {body}
  </section>;
}
