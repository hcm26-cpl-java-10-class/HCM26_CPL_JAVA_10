import { Copy, ExternalLink, GitBranch, GitCommitHorizontal, GitMerge, MoreHorizontal, Pin, RefreshCw, Unlink } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import { taskBranchName, taskCommitMessage } from "@/lib/task-key";
import { cn } from "@/lib/utils";
import type { GitCommitItem, LinkedPullRequest } from "@/types/features/git-integration";
import { PullRequestStateBadge } from "@/pages/management/git-integration/components/SyncDataBadges";
import { pullRequestAccent } from "@/pages/management/git-integration/components/git-integration.styles";
import { formatDateTime, formatRelative } from "@/pages/management/git-integration/git-integration.format";
import { useBacklogGitLinks, usePinGitLink, useUnlinkGitLink } from "@/pages/management/git-integration/useGitIntegration";
import { GitLinkSourceLabel } from "./GitLinkSourceLabel";
import { LinkPullRequestPopover } from "./LinkPullRequestPopover";

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`, { description: text });
  } catch {
    toast.error(`Could not copy the ${what.toLowerCase()}`);
  }
}

/** One-click copies so a commit gets the Task ID without typing it. */
function CopyButtons({ taskKey, title }: { taskKey: string; title?: string | null }) {
  return <div className="flex flex-wrap gap-1.5">
    <Button type="button" variant="outline" size="xs" className="h-7 gap-1 px-2 text-[11px]" onClick={() => void copy(taskKey, "Task ID")}>
      <Copy className="size-3" aria-hidden="true" /><span className="font-mono">{taskKey}</span>
    </Button>
    <Button type="button" variant="outline" size="xs" className="h-7 gap-1 px-2 text-[11px]"
      onClick={() => void copy(taskCommitMessage(taskKey, title), "Commit message")}>
      <GitCommitHorizontal className="size-3" aria-hidden="true" />Commit message
    </Button>
    <Button type="button" variant="outline" size="xs" className="h-7 gap-1 px-2 text-[11px]"
      onClick={() => void copy(taskBranchName(taskKey, title), "Branch name")}>
      <GitBranch className="size-3" aria-hidden="true" />Branch name
    </Button>
  </div>;
}

/**
 * A pull request of the task: state colour as a 2px left accent plus the badge, how it was
 * linked (Auto · from title / Manual · by …) and, for people who may update the task, pin / unlink.
 */
function PullRequestRow({ row, taskKey, canEdit, onPin, onUnlink }: {
  row: LinkedPullRequest; taskKey: string | null; canEdit: boolean; onPin: () => void; onUnlink: () => void;
}) {
  const { pullRequest: pr, link } = row;
  const summary = pr.reviewSummary;
  return <li className={cn("flex items-start gap-2 py-2.5 pl-2.5 pr-2", pullRequestAccent(pr.state, pr.draft))}>
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <PullRequestStateBadge state={pr.state} draft={pr.draft} />
        <p className="min-w-0 break-words text-xs font-medium leading-5"><span className="text-muted-foreground">#{pr.number}</span> {pr.title}</p>
      </div>
      <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
        {pr.headRef && pr.baseRef && <span><span className="font-mono">{pr.headRef}</span> → <span className="font-mono">{pr.baseRef}</span></span>}
        {summary.approved > 0 && <span className="text-emerald-700 dark:text-emerald-400">· ✓ {summary.approved} approved</span>}
        {summary.changesRequested > 0 && <span className="text-red-700 dark:text-red-400">· ✗ {summary.changesRequested} changes requested</span>}
        <span>· <time dateTime={pr.updatedAt} title={formatDateTime(pr.updatedAt)}>{formatRelative(pr.updatedAt)}</time></span>
      </p>
      <GitLinkSourceLabel link={link} />
    </div>
    <div className="flex shrink-0 items-center">
      {pr.htmlUrl && <a href={pr.htmlUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open pull request #${pr.number} on GitHub (new tab)`}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><ExternalLink className="size-3.5" /></a>}
      {canEdit && <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="size-6" aria-label={`Link options for pull request #${pr.number}`}>
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {link.source === "AUTO" && <>
            <DropdownMenuItem onSelect={onPin} className="items-start">
              <Pin className="mt-0.5" />
              <span><span className="block">Keep linked</span>
                <span className="block text-[11px] text-muted-foreground">Stays even if {taskKey ?? "the Task ID"} is removed from the pull request</span></span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>}
          <DropdownMenuItem onSelect={onUnlink} className="items-start text-red-700 focus:text-red-700 dark:text-red-400 dark:focus:text-red-400">
            <Unlink className="mt-0.5" />
            <span><span className="block">Unlink</span>
              <span className="block text-[11px] text-muted-foreground">Won't be linked again automatically</span></span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>}
    </div>
  </li>;
}

function CommitRow({ commit }: { commit: GitCommitItem }) {
  return <li className="flex items-start gap-2 px-3 py-2">
    {commit.merge
      ? <GitMerge className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label="Merge commit" />
      : <GitCommitHorizontal className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
    <div className="min-w-0 flex-1">
      <p className="truncate text-xs font-medium" title={commit.message}>{commit.headline || "(no message)"}</p>
      <p className="truncate text-[11px] text-muted-foreground">
        {commit.authorLogin ?? commit.authorName ?? "Unknown author"}
        {commit.branch && <> · <span className="font-mono">{commit.branch}</span></>}
        {" · "}<time dateTime={commit.committedAt} title={formatDateTime(commit.committedAt)}>{formatRelative(commit.committedAt)}</time>
      </p>
    </div>
    {commit.htmlUrl ? <a href={commit.htmlUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open commit ${commit.shortSha} on GitHub (new tab)`}
      className="inline-flex shrink-0 items-center gap-1 rounded border px-1 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground">
      {commit.shortSha}<ExternalLink className="size-2.5" aria-hidden="true" />
    </a> : <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{commit.shortSha}</span>}
  </li>;
}

/**
 * US-SY-05 / US-TM-03 Task Detail: the pull requests and commits that name this task's Task ID,
 * linked automatically as GitHub sends them (no "sync" button), plus pull requests linked by
 * hand. Refreshes every 30 s while open. Linking never changes the task status.
 */
export function BacklogDevelopmentSection({ itemId, taskKey, title }: { itemId: number; taskKey?: string | null; title?: string | null }) {
  const [page, setPage] = useState(0);
  const query = useBacklogGitLinks(itemId, page);
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
    body = <div role="alert" className="flex items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
      Linked commits could not be loaded.
      <Button type="button" variant="ghost" size="xs" className="h-6" disabled={query.isFetching} onClick={() => void query.refetch()}>
        <RefreshCw className={cn("size-3", query.isFetching && "animate-spin")} />Try again
      </Button>
    </div>;
  } else if (data && total === 0) {
    body = <div className="space-y-2.5 rounded-lg border border-dashed bg-muted/30 px-3 py-3">
      <p className="text-xs text-muted-foreground">
        {key
          ? <>No commits for <span className="font-mono font-medium text-foreground">{key}</span> yet. Put this Task ID in a commit message and it is linked here within seconds.</>
          : "This work item has no Task ID yet."}
      </p>
      {key && <CopyButtons taskKey={key} title={title} />}
      {canLink && <p className="text-[11px] text-muted-foreground">
        Already opened a pull request? <LinkPullRequestPopover itemId={itemId} taskKey={key} trigger="link" />
      </p>}
      {!data.repository && <p className="text-[11px] text-muted-foreground">The project has no linked repository yet.</p>}
    </div>;
  } else if (data) {
    const commitPages = data.commits.totalPages;
    body = <div className={cn("overflow-hidden rounded-lg border bg-card transition-opacity", query.isFetching && !query.isPending && "opacity-80")}>
      {data.pullRequests.length > 0 && <ul aria-label="Linked pull requests" className="divide-y border-b">
        {data.pullRequests.map(row => <PullRequestRow key={row.link.id} row={row} taskKey={key} canEdit={canEdit}
          onPin={() => pin.mutate(row.link.id)}
          onUnlink={() => unlink.mutate({ linkId: row.link.id, number: row.pullRequest.number })} />)}
      </ul>}
      {data.commits.items.length > 0 && <ul aria-label="Linked commits" className="divide-y">
        {data.commits.items.map(commit => <CommitRow key={commit.id} commit={commit} />)}
      </ul>}
      {commitPages > 1 && <footer className="flex items-center justify-between gap-2 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
        <span aria-live="polite">Commits {page * data.commits.size + 1}–{Math.min((page + 1) * data.commits.size, data.commitCount)} of {data.commitCount}</span>
        <span className="flex gap-1">
          <Button type="button" variant="ghost" size="xs" className="h-6 px-2" disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</Button>
          <Button type="button" variant="ghost" size="xs" className="h-6 px-2" disabled={page + 1 >= commitPages} onClick={() => setPage(page + 1)}>Older</Button>
        </span>
      </footer>}
    </div>;
  }

  return <section aria-labelledby={`development-${itemId}`} className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <h3 id={`development-${itemId}`} className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        Development
        {data && total > 0 && <span className="text-xs font-normal text-muted-foreground">
          {data.commitCount} {data.commitCount === 1 ? "commit" : "commits"}
          {data.pullRequestCount > 0 && <> · {data.pullRequestCount} {data.pullRequestCount === 1 ? "pull request" : "pull requests"}</>}
        </span>}
      </h3>
      <div className="flex items-center gap-1">
      {canLink && total > 0 && <LinkPullRequestPopover itemId={itemId} taskKey={key} />}
      {key && data && total > 0 && <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Copy Task ID, commit message or branch name">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void copy(key, "Task ID")}><Copy />Copy Task ID</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void copy(taskCommitMessage(key, title), "Commit message")}><GitCommitHorizontal />Copy commit message</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void copy(taskBranchName(key, title), "Branch name")}><GitBranch />Copy branch name</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>}
      </div>
    </div>
    {body}
  </section>;
}
