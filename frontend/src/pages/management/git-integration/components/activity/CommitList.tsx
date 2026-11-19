import { Copy, ExternalLink, GitBranch, GitCommitHorizontal, GitMerge, ListChecks, Loader2 } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import type { GitCommitItem, GitTaskRef } from "@/types/features/git-integration";
import type { GitHubLinkFilter, GitHubTabPatch, GitHubTabState } from "../../github-tab.params";
import { dayKey, formatDateTime, formatDayLabel, formatRelative } from "../../git-integration.format";
import { useRecheckTaskLinks, useRepositoryCommits } from "../../useGitIntegration";
import { TaskRefChips } from "../TaskRefChips";
import { ContributorAvatar } from "./ContributorAvatar";
import { EmptyState, ErrorState, FilterChips, ListSkeleton, Pager, SearchBox, Segmented, type ActiveFilter } from "./ActivityControls";

const PAGE_SIZE = 20;

/** US-SY-05: task link verdict filter; "Needs attention" = no Task ID, unknown, or another project's. */
const LINK_FILTERS: Array<{ id: GitHubLinkFilter | "ALL"; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "LINKED", label: "Linked to tasks" },
  { id: "NEEDS_ATTENTION", label: "Needs attention" },
];

async function copySha(sha: string) {
  try {
    await navigator.clipboard.writeText(sha);
    toast.success("Commit SHA copied.");
  } catch {
    toast.error("Could not copy. Open the commit on GitHub to copy its SHA.");
  }
}

/**
 * One commit. Author and branch are filter shortcuts; linked Task IDs open their task.
 * `compact` drops the filter shortcuts (used in the Insights preview).
 */
export function CommitRow({ commit, onAuthor, onBranch, onOpenTask, compact = false }: {
  commit: GitCommitItem;
  onAuthor?: (author: string) => void;
  onBranch?: (branch: string) => void;
  onOpenTask?: (ref: GitTaskRef) => void;
  compact?: boolean;
}) {
  const author = commit.authorLogin ?? commit.authorName;
  return <li className={cn("flex items-start gap-3 px-4 sm:px-5", compact ? "py-2.5" : "py-3")}>
    {commit.merge
      ? <GitMerge className="mt-0.5 size-4 shrink-0 text-violet-500 dark:text-violet-400" aria-label="Merge commit" />
      : <GitCommitHorizontal className="mt-0.5 size-4 shrink-0 text-sky-500 dark:text-sky-400" aria-hidden="true" />}
    <div className="min-w-0 flex-1 space-y-1">
      <p className={cn("break-words font-medium leading-5", compact ? "line-clamp-1 text-[13px]" : "text-sm")} title={commit.message}>{commit.headline || "(no message)"}</p>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ContributorAvatar login={author} />
          {author && onAuthor ? <button type="button" className="font-medium hover:text-foreground hover:underline" onClick={() => onAuthor(author)}
            title={`Show commits by ${author}`}>{author}</button> : <span className="font-medium">{author ?? "Unknown author"}</span>}
        </span>
        {commit.branch && (onBranch
          ? <button type="button" onClick={() => onBranch(commit.branch!)} title={`Show commits on ${commit.branch}`}
            className="inline-flex max-w-56 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] hover:bg-muted/70 hover:text-foreground">
            <GitBranch className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{commit.branch}</span>
          </button>
          : <span className="inline-flex max-w-56 items-center gap-1 font-mono"><GitBranch className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{commit.branch}</span></span>)}
        <time dateTime={commit.committedAt} title={formatDateTime(commit.committedAt)}>{formatRelative(commit.committedAt)}</time>
        {!compact && commit.filesChanged != null && <span className="hidden sm:inline">· {commit.filesChanged} {commit.filesChanged === 1 ? "file" : "files"}</span>}
      </div>
      <TaskRefChips refs={commit.taskRefs ?? []} onOpen={onOpenTask} />
    </div>
    <div className="flex shrink-0 items-center gap-0.5">
      <button type="button" onClick={() => void copySha(commit.sha)} title="Copy full SHA" aria-label={`Copy SHA of commit ${commit.shortSha}`}
        className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">
        {commit.shortSha}<Copy className="size-3" aria-hidden="true" />
      </button>
      {commit.htmlUrl && <Button variant="ghost" size="icon" className="size-7" asChild>
        <a href={commit.htmlUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open commit ${commit.shortSha} on GitHub (new tab)`}><ExternalLink className="size-3.5" /></a>
      </Button>}
    </div>
  </li>;
}

/** Consecutive commits of the same local day (the list is newest first). */
function groupByDay(commits: GitCommitItem[]) {
  const groups: Array<{ key: string; commits: GitCommitItem[] }> = [];
  for (const commit of commits) {
    const key = dayKey(commit.committedAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.commits.push(commit); else groups.push({ key, commits: [commit] });
  }
  return groups;
}

type CommitFilters = Pick<GitHubTabState, "q" | "author" | "branch" | "link" | "page">;

/**
 * WS-GH-01: commits of the project's repository grouped by day, with sticky day headers.
 * Filters live in the URL (see `github-tab.params.ts`).
 */
export function CommitList({ projectId, filters, onChange, onOpenTask }: {
  projectId: number;
  filters: CommitFilters;
  onChange: (patch: GitHubTabPatch) => void;
  onOpenTask: (ref: GitTaskRef) => void;
}) {
  const { q, author, branch, link, page } = filters;
  const query = useRepositoryCommits(projectId, { q: q || undefined, author, branch, link, page, size: PAGE_SIZE });
  const { hasPermission } = usePermissions();
  const recheck = useRecheckTaskLinks(projectId);
  const top = useRef<HTMLDivElement>(null);
  const data = query.data;
  const busy = query.isFetching && !query.isPending;
  const filtered = !!(q || author || branch || link);
  const clearAll = () => onChange({ q: "", author: undefined, branch: undefined, link: undefined });

  const active: ActiveFilter[] = [];
  if (author) active.push({ key: "author", label: "Author", value: author, onClear: () => onChange({ author: undefined }) });
  if (branch) active.push({ key: "branch", label: "Branch", value: branch, onClear: () => onChange({ branch: undefined }) });

  let body: ReactNode;
  if (query.isPending) body = <ListSkeleton />;
  else if (query.isError) body = <ErrorState retrying={query.isFetching} onRetry={() => void query.refetch()} />;
  else if (data && data.items.length === 0) {
    body = page > 0 && data.totalElements > 0
      ? <EmptyState action={<Button variant="outline" size="sm" onClick={() => onChange({ page: 0 })}>Go to the first page</Button>}>This page is empty.</EmptyState>
      : link === "NEEDS_ATTENTION" && !q && !author && !branch
        ? <EmptyState>Every commit references a task of this project.</EmptyState>
        : filtered
          ? <EmptyState action={<Button variant="outline" size="sm" onClick={clearAll}>Clear filters</Button>}>No commits match these filters.</EmptyState>
          : <EmptyState>No commits yet. Push to the repository and they appear here within seconds.</EmptyState>;
  } else if (data) {
    body = <div className={cn("transition-opacity", busy && "opacity-70")}>
      {groupByDay(data.items).map(group => <section key={group.key} aria-label={formatDayLabel(group.key)}>
        <h3 className="sticky top-0 z-10 flex items-center justify-between border-b bg-slate-50/95 px-4 py-1.5 text-[11px] font-semibold text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-slate-50/80 dark:bg-muted/90 sm:px-5">
          <span>{formatDayLabel(group.key)}</span>
          <span className="font-normal tabular-nums">{group.commits.length} {group.commits.length === 1 ? "commit" : "commits"}</span>
        </h3>
        <ul className="divide-y">
          {group.commits.map(commit => <CommitRow key={commit.id} commit={commit} onOpenTask={onOpenTask}
            onAuthor={value => onChange({ author: value })} onBranch={value => onChange({ branch: value })} />)}
        </ul>
      </section>)}
    </div>;
  }

  return <section aria-label="Commits" className="min-w-0">
    <div ref={top} className="flex scroll-mt-4 flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-5">
      <SearchBox value={q} onCommit={value => onChange({ q: value })} placeholder="Search message or SHA" label="Search commits" />
      <Segmented label="Filter commits by task link" value={link ?? "ALL"} options={LINK_FILTERS}
        onChange={value => onChange({ link: value === "ALL" ? undefined : value })} />
      {hasPermission("GIT_INTEGRATION_MANAGE") && <Button variant="outline" size="sm" className="h-8" disabled={recheck.isPending}
        onClick={() => recheck.mutate()} title="Check unknown or other-project Task IDs again, e.g. after a task was restored or moved into this project">
        {recheck.isPending ? <Loader2 className="animate-spin" /> : <ListChecks />}Re-check task links
      </Button>}
    </div>
    <FilterChips filters={active} onClearAll={clearAll} />
    {body}
    <Pager data={data} page={page} busy={busy} onPage={next => {
      onChange({ page: next });
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }} />
  </section>;
}
