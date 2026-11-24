import { ArrowLeft } from "lucide-react";
import { useState, type ReactNode } from "react";
import { FaGithub } from "react-icons/fa";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { Segmented } from "@/pages/management/git-integration/components/activity/ActivityControls";
import { useBacklogGitLinks, usePinGitLink, useUnlinkGitLink } from "@/pages/management/git-integration/useGitIntegration";
import { CommitRow, CopyMenu, DevelopmentError, PullRequestRow } from "./BacklogDevelopmentParts";
import { plural, rankPullRequests, type DevelopmentTab } from "./development.utils";
import { LinkPullRequestPopover } from "./LinkPullRequestPopover";

const COMMIT_PAGE_SIZE = 20;

/** Inside a workspace, the same Task ID searched in the workspace's GitHub tab. */
function useGitHubTabHref(taskKey: string | null) {
  const location = useLocation();
  if (!taskKey || !location.pathname.startsWith("/management/workspaces/")) return null;
  const next = new URLSearchParams();
  const project = new URLSearchParams(location.search).get("project");
  if (project) next.set("project", project);
  next.set("tab", "github");
  next.set("view", "commits");
  next.set("q", taskKey);
  return `${location.pathname}?${next}`;
}

/**
 * US-TM-03 Task Detail, "View all": every pull request and commit of the task in the panel
 * itself (the Development section only previews a few). Back returns to the task.
 */
export function BacklogDevelopmentPanel({ itemId, taskKey, title, initialTab, onBack }: {
  itemId: number;
  taskKey?: string | null;
  title?: string | null;
  initialTab: DevelopmentTab;
  onBack: () => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const [page, setPage] = useState(0);
  const query = useBacklogGitLinks(itemId, page, true, COMMIT_PAGE_SIZE);
  const data = query.data;
  const key = data?.taskKey ?? taskKey ?? null;
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("SPRINT_BACKLOG_UPDATE");
  const pin = usePinGitLink(itemId);
  const unlink = useUnlinkGitLink(itemId, key);
  const gitHubTab = useGitHubTabHref(key);
  const busy = query.isFetching && !query.isPending;

  let body: ReactNode;
  if (query.isPending) {
    body = <div role="status" aria-label="Loading" className="space-y-3 p-4">
      {[0, 1, 2].map(index => <div key={index} className="space-y-1.5"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/2" /></div>)}
    </div>;
  } else if (query.isError) {
    body = <div className="p-4"><DevelopmentError retrying={query.isFetching} onRetry={() => void query.refetch()} /></div>;
  } else if (data && tab === "pulls") {
    body = data.pullRequests.length === 0
      ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">No pull request is linked to this task.</p>
      : <ul aria-label="Linked pull requests" className="divide-y border-b">
        {rankPullRequests(data.pullRequests).map(row => <PullRequestRow key={row.link.id} row={row} taskKey={key} canEdit={canEdit}
          onPin={() => pin.mutate(row.link.id)}
          onUnlink={() => unlink.mutate({ linkId: row.link.id, number: row.pullRequest.number })} />)}
      </ul>;
  } else if (data) {
    body = data.commits.items.length === 0
      ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">{page > 0 ? "This page is empty." : "No commit names this task yet."}</p>
      : <ul aria-label="Linked commits" className="divide-y border-b">
        {data.commits.items.map(commit => <CommitRow key={commit.id} commit={commit} />)}
      </ul>;
  }

  const commitPages = data?.commits.totalPages ?? 0;
  return <section aria-labelledby={`development-all-${itemId}`} className="flex min-h-0 flex-1 flex-col">
    <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={onBack} autoFocus>
        <ArrowLeft className="size-4" />Back
      </Button>
      <h3 id={`development-all-${itemId}`} className="min-w-0 truncate text-sm font-semibold">
        Development{key && <span className="font-normal text-muted-foreground"> · <span className="font-mono">{key}</span></span>}
      </h3>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {canEdit && data?.repository && <LinkPullRequestPopover itemId={itemId} taskKey={key} />}
        {key && <CopyMenu taskKey={key} title={title} />}
      </div>
    </div>

    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-2.5">
      <Segmented label="Show" value={tab} onChange={setTab} options={[
        { id: "pulls", label: <>Pull requests <span className="tabular-nums opacity-70">{data?.pullRequestCount ?? ""}</span></> },
        { id: "commits", label: <>Commits <span className="tabular-nums opacity-70">{data?.commitCount ?? ""}</span></> },
      ]} />
      {gitHubTab && <Link to={gitHubTab} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline">
        <FaGithub className="size-3.5" aria-hidden="true" />Open in GitHub tab
      </Link>}
    </div>

    <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain border-t transition-opacity", busy && "opacity-80")}>
      {body}
    </div>

    {tab === "commits" && data && commitPages > 1 && <footer className="flex shrink-0 items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
      <span aria-live="polite">{page * data.commits.size + 1}–{Math.min((page + 1) * data.commits.size, data.commitCount)} of {plural(data.commitCount, "commit")}</span>
      <span className="flex gap-1">
        <Button type="button" variant="outline" size="xs" className="h-7 px-2" disabled={page === 0 || busy} onClick={() => setPage(page - 1)}>Newer</Button>
        <Button type="button" variant="outline" size="xs" className="h-7 px-2" disabled={page + 1 >= commitPages || busy} onClick={() => setPage(page + 1)}>Older</Button>
      </span>
    </footer>}
  </section>;
}
