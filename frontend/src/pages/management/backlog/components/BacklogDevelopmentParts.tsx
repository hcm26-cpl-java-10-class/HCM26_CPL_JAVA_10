import { Copy, ExternalLink, GitBranch, GitCommitHorizontal, GitMerge, MoreHorizontal, Pin, RefreshCw, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { taskBranchName, taskCommitMessage } from "@/lib/task-key";
import { cn } from "@/lib/utils";
import type { GitCommitItem, LinkedPullRequest } from "@/types/features/git-integration";
import { PullRequestStateBadge } from "@/pages/management/git-integration/components/SyncDataBadges";
import { pullRequestAccent } from "@/pages/management/git-integration/components/git-integration.styles";
import { formatDateTime, formatRelative } from "@/pages/management/git-integration/git-integration.format";
import { copyText } from "./development.utils";
import { GitLinkSourceLabel } from "./GitLinkSourceLabel";

/** One-click copies so a commit gets the Task ID without typing it. */
export function CopyButtons({ taskKey, title }: { taskKey: string; title?: string | null }) {
  return <div className="flex flex-wrap gap-1.5">
    <Button type="button" variant="outline" size="xs" className="h-7 gap-1 px-2 text-[11px]" onClick={() => void copyText(taskKey, "Task ID")}>
      <Copy className="size-3" aria-hidden="true" /><span className="font-mono">{taskKey}</span>
    </Button>
    <Button type="button" variant="outline" size="xs" className="h-7 gap-1 px-2 text-[11px]"
      onClick={() => void copyText(taskCommitMessage(taskKey, title), "Commit message")}>
      <GitCommitHorizontal className="size-3" aria-hidden="true" />Commit message
    </Button>
    <Button type="button" variant="outline" size="xs" className="h-7 gap-1 px-2 text-[11px]"
      onClick={() => void copyText(taskBranchName(taskKey, title), "Branch name")}>
      <GitBranch className="size-3" aria-hidden="true" />Branch name
    </Button>
  </div>;
}

/** The same copies as a menu, for the section heading once there is something linked. */
export function CopyMenu({ taskKey, title }: { taskKey: string; title?: string | null }) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Copy Task ID, commit message or branch name">
        <MoreHorizontal className="size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={() => void copyText(taskKey, "Task ID")}><Copy />Copy Task ID</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => void copyText(taskCommitMessage(taskKey, title), "Commit message")}><GitCommitHorizontal />Copy commit message</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => void copyText(taskBranchName(taskKey, title), "Branch name")}><GitBranch />Copy branch name</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

export function DevelopmentError({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return <div role="alert" className="flex items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
    Linked commits could not be loaded.
    <Button type="button" variant="ghost" size="xs" className="h-6" disabled={retrying} onClick={onRetry}>
      <RefreshCw className={cn("size-3", retrying && "animate-spin")} />Try again
    </Button>
  </div>;
}

/**
 * A pull request of the task: state (2px left accent + badge), number and title; last update,
 * reviews and branches; how it was linked. `compact` (the preview) is two lines: one-line title
 * and the link source as an icon (sky pin = manual, sparkles = auto). People who may update the
 * task get pin / unlink.
 */
export function PullRequestRow({ row, taskKey, canEdit, onPin, onUnlink, compact = false }: {
  row: LinkedPullRequest; taskKey: string | null; canEdit: boolean; onPin: () => void; onUnlink: () => void; compact?: boolean;
}) {
  const { pullRequest: pr, link } = row;
  const summary = pr.reviewSummary;
  return <li className={cn("flex items-start gap-2 py-2 pl-2.5 pr-2", pullRequestAccent(pr.state, pr.draft))}>
    <div className="min-w-0 flex-1 space-y-0.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <PullRequestStateBadge state={pr.state} draft={pr.draft} />
        <p className={cn("min-w-0 text-xs font-medium leading-5", compact ? "truncate" : "break-words")} title={pr.title}>
          <span className="text-muted-foreground">#{pr.number}</span> {pr.title}
        </p>
      </div>
      <p className={cn("flex min-w-0 items-center gap-x-1.5 text-[11px] text-muted-foreground", compact ? "overflow-hidden whitespace-nowrap" : "flex-wrap")}>
        {compact && <GitLinkSourceLabel link={link} iconOnly />}
        <time dateTime={pr.updatedAt} title={`Updated ${formatDateTime(pr.updatedAt)}`} className="shrink-0">{formatRelative(pr.updatedAt)}</time>
        {summary.approved > 0 && <span className="shrink-0 text-emerald-700 dark:text-emerald-400">· ✓ {summary.approved} approved</span>}
        {summary.changesRequested > 0 && <span className="shrink-0 text-red-700 dark:text-red-400">· ✗ {summary.changesRequested} changes requested</span>}
        {pr.headRef && pr.baseRef && <span className="min-w-0 truncate" title={`${pr.headRef} → ${pr.baseRef}`}>
          · <span className="font-mono">{pr.headRef}</span> → <span className="font-mono">{pr.baseRef}</span>
        </span>}
      </p>
      {!compact && <GitLinkSourceLabel link={link} />}
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

export function CommitRow({ commit }: { commit: GitCommitItem }) {
  return <li className="flex items-start gap-2 px-3 py-2">
    {commit.merge
      ? <GitMerge className="mt-0.5 size-3.5 shrink-0 text-violet-500 dark:text-violet-400" aria-label="Merge commit" />
      : <GitCommitHorizontal className="mt-0.5 size-3.5 shrink-0 text-sky-500 dark:text-sky-400" aria-hidden="true" />}
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
