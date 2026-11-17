import { useDebounce } from "@uidotdev/usehooks";
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, GitCommitHorizontal, GitPullRequest, Loader2, RefreshCw, Search, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { GitCommitItem, GitPage, GitPullRequestItem, GitPullRequestState } from "@/types/features/git-integration";
import { formatDateTime, formatRelative } from "../git-integration.format";
import { usePullRequestDetail, useRepositoryCommits, useRepositoryPullRequests } from "../useGitIntegration";
import { GitHubTile } from "./GitIntegrationHeader";
import { PullRequestStateBadge, ReviewStateBadge } from "./SyncDataBadges";

const PAGE_SIZE = 20;
type Tab = "commits" | "pull-requests";

const PR_FILTERS: Array<{ id: GitPullRequestState | "ALL"; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "OPEN", label: "Open" },
  { id: "MERGED", label: "Merged" },
  { id: "CLOSED", label: "Closed" },
];

function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: Array<{ id: T; label: ReactNode }>;
  onChange: (value: T) => void;
}) {
  return <div role="group" aria-label={label} className="inline-flex rounded-lg border bg-card p-0.5">
    {options.map(option => <button key={option.id} type="button" aria-pressed={value === option.id} onClick={() => onChange(option.id)}
      className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        value === option.id ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-muted-foreground hover:text-foreground")}>
      {option.label}
    </button>)}
  </div>;
}

function ListSkeleton() {
  return <div role="status" aria-label="Loading" className="divide-y">
    {Array.from({ length: 6 }, (_, index) => <div key={index} className="space-y-2 px-5 py-3">
      <Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" />
    </div>)}
  </div>;
}

function ErrorState({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground">
    The list could not be loaded.
    <Button variant="outline" size="sm" disabled={retrying} onClick={onRetry}><RefreshCw className={retrying ? "animate-spin" : undefined} />Try again</Button>
  </div>;
}

function Pager<T>({ data, page, busy, onPage }: { data?: GitPage<T>; page: number; busy: boolean; onPage: (page: number) => void }) {
  if (!data || data.totalElements === 0) return null;
  const from = data.page * data.size + 1;
  const to = Math.min((data.page + 1) * data.size, data.totalElements);
  return <footer className="flex items-center justify-between gap-2 border-t px-5 py-3">
    <p className="text-xs text-muted-foreground" aria-live="polite">
      Showing <span className="tabular-nums">{from}–{to}</span> of <span className="tabular-nums">{data.totalElements}</span>
    </p>
    <div className="flex items-center gap-1">
      <Button variant="outline" size="sm" className="h-8" disabled={page === 0 || busy} onClick={() => onPage(page - 1)}><ChevronLeft />Prev</Button>
      <Button variant="outline" size="sm" className="h-8" disabled={page + 1 >= data.totalPages || busy} onClick={() => onPage(page + 1)}>Next<ChevronRight /></Button>
    </div>
  </footer>;
}

function CommitRow({ commit, onAuthor }: { commit: GitCommitItem; onAuthor: (author: string) => void }) {
  const author = commit.authorLogin ?? commit.authorName;
  return <li className="flex items-start gap-3 px-5 py-3">
    <GitCommitHorizontal className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    <div className="min-w-0 flex-1 space-y-0.5">
      <p className="break-words text-sm font-medium leading-5" title={commit.message}>{commit.headline || "(no message)"}</p>
      <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
        {author ? <button type="button" className="font-medium hover:text-foreground hover:underline" onClick={() => onAuthor(author)}
          aria-label={`Show commits by ${author}`}>{author}</button> : <span>Unknown author</span>}
        {commit.branch && <span>· <span className="font-mono">{commit.branch}</span></span>}
        <span>· <time dateTime={commit.committedAt} title={formatDateTime(commit.committedAt)}>{formatRelative(commit.committedAt)}</time></span>
        {commit.filesChanged != null && <span>· {commit.filesChanged} {commit.filesChanged === 1 ? "file" : "files"}</span>}
      </p>
    </div>
    {commit.htmlUrl ? <a href={commit.htmlUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open commit ${commit.shortSha} on GitHub (new tab)`}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">
      {commit.shortSha}<ExternalLink className="size-3" aria-hidden="true" />
    </a> : <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{commit.shortSha}</span>}
  </li>;
}

function CommitsTab({ projectId, active }: { projectId: number; active: boolean }) {
  const [search, setSearch] = useState("");
  const [author, setAuthor] = useState<string>();
  const q = useDebounce(search, 300);
  const resultKey = `${q}|${author ?? ""}`;
  const [paging, setPaging] = useState({ key: resultKey, page: 0 });
  const page = paging.key === resultKey ? paging.page : 0;
  const query = useRepositoryCommits(projectId, { q, author, page, size: PAGE_SIZE }, active);
  const data = query.data;
  const busy = query.isFetching && !query.isPending;

  let body: ReactNode;
  if (query.isPending) body = <ListSkeleton />;
  else if (query.isError) body = <ErrorState retrying={query.isFetching} onRetry={() => void query.refetch()} />;
  else if (data && data.items.length === 0) {
    body = <p className="px-6 py-12 text-center text-sm text-muted-foreground">
      {q || author ? "No commits match these filters." : "No commits yet. Push to the repository and they appear here within seconds."}
    </p>;
  } else if (data) {
    body = <ul aria-label="Commits" className={cn("divide-y transition-opacity", busy && "opacity-70")}>
      {data.items.map(commit => <CommitRow key={commit.id} commit={commit} onAuthor={setAuthor} />)}
    </ul>;
  }

  return <>
    <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
      <SearchBox value={search} onChange={setSearch} placeholder="Search message or SHA" label="Search commits" />
      {author && <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs">
        Author: <span className="font-medium">{author}</span>
        <button type="button" onClick={() => setAuthor(undefined)} aria-label="Clear author filter" className="rounded p-0.5 hover:bg-background"><X className="size-3" /></button>
      </span>}
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
    <Pager data={data} page={page} busy={busy} onPage={next => setPaging({ key: resultKey, page: next })} />
  </>;
}

function PullRequestReviews({ projectId, number }: { projectId: number; number: number }) {
  const query = usePullRequestDetail(projectId, number);
  if (query.isPending) return <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />Loading reviews…</p>;
  if (query.isError || !query.data) return <p className="text-xs text-muted-foreground">Reviews could not be loaded.</p>;
  const detail = query.data;
  return <div className="space-y-2">
    {detail.mergedByLogin && <p className="text-[11px] text-muted-foreground">Merged by <span className="font-medium text-foreground">{detail.mergedByLogin}</span></p>}
    {detail.reviews.length === 0 ? <p className="text-xs text-muted-foreground">No reviews yet.</p>
      : <ol aria-label={`Reviews of pull request #${number}`} className="space-y-1.5">
        {detail.reviews.map(review => <li key={review.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <ReviewStateBadge state={review.state} />
          <span className="font-medium">{review.reviewerLogin ?? "Unknown reviewer"}</span>
          {review.submittedAt && <time className="text-muted-foreground" dateTime={review.submittedAt} title={formatDateTime(review.submittedAt)}>
            {formatRelative(review.submittedAt)}
          </time>}
          {review.body && <p className="w-full whitespace-pre-line break-words pl-1 text-muted-foreground">{review.body}</p>}
        </li>)}
      </ol>}
  </div>;
}

function PullRequestRow({ projectId, pr, expanded, onToggle }: {
  projectId: number;
  pr: GitPullRequestItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const summary = pr.reviewSummary;
  return <li className="px-5 py-3">
    <div className="flex items-start gap-3">
      <button type="button" onClick={onToggle} aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} reviews of #${pr.number}`}
        className="mt-0.5 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
        <ChevronDown className={cn("size-4 transition-transform", !expanded && "-rotate-90")} />
      </button>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <PullRequestStateBadge state={pr.state} draft={pr.draft} />
          <p className="min-w-0 break-words text-sm font-medium leading-5"><span className="text-muted-foreground">#{pr.number}</span> {pr.title}</p>
        </div>
        <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
          <span>{pr.authorLogin ?? "Unknown author"}</span>
          {pr.headRef && pr.baseRef && <span>· <span className="font-mono">{pr.headRef}</span> → <span className="font-mono">{pr.baseRef}</span></span>}
          <span>· updated <time dateTime={pr.updatedAt} title={formatDateTime(pr.updatedAt)}>{formatRelative(pr.updatedAt)}</time></span>
          {pr.additions != null && pr.deletions != null && <span>· <span className="text-emerald-700 dark:text-emerald-400">+{pr.additions}</span> <span className="text-red-700 dark:text-red-400">−{pr.deletions}</span></span>}
        </p>
        {(summary.approved > 0 || summary.changesRequested > 0 || summary.commented > 0) && <p className="flex flex-wrap gap-x-2 text-[11px]">
          {summary.approved > 0 && <span className="text-emerald-700 dark:text-emerald-400">✓ {summary.approved} approved</span>}
          {summary.changesRequested > 0 && <span className="text-red-700 dark:text-red-400">✗ {summary.changesRequested} changes requested</span>}
          {summary.commented > 0 && <span className="text-muted-foreground">{summary.commented} commented</span>}
        </p>}
      </div>
      {pr.htmlUrl && <Button variant="ghost" size="icon" className="size-7 shrink-0" asChild>
        <a href={pr.htmlUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open pull request #${pr.number} on GitHub (new tab)`}><ExternalLink className="size-3.5" /></a>
      </Button>}
    </div>
    {expanded && <div className="ml-8 mt-2 rounded-lg bg-muted/40 px-3 py-2.5"><PullRequestReviews projectId={projectId} number={pr.number} /></div>}
  </li>;
}

function PullRequestsTab({ projectId, active }: { projectId: number; active: boolean }) {
  const [search, setSearch] = useState("");
  const [state, setState] = useState<GitPullRequestState | "ALL">("ALL");
  const [expanded, setExpanded] = useState<number>();
  const q = useDebounce(search, 300);
  const resultKey = `${q}|${state}`;
  const [paging, setPaging] = useState({ key: resultKey, page: 0 });
  const page = paging.key === resultKey ? paging.page : 0;
  const query = useRepositoryPullRequests(projectId, { q, state: state === "ALL" ? undefined : state, page, size: PAGE_SIZE }, active);
  const data = query.data;
  const busy = query.isFetching && !query.isPending;

  let body: ReactNode;
  if (query.isPending) body = <ListSkeleton />;
  else if (query.isError) body = <ErrorState retrying={query.isFetching} onRetry={() => void query.refetch()} />;
  else if (data && data.items.length === 0) {
    body = <p className="px-6 py-12 text-center text-sm text-muted-foreground">
      {q || state !== "ALL" ? "No pull requests match these filters." : "No pull requests yet."}
    </p>;
  } else if (data) {
    body = <ul aria-label="Pull requests" className={cn("divide-y transition-opacity", busy && "opacity-70")}>
      {data.items.map(pr => <PullRequestRow key={pr.id} projectId={projectId} pr={pr} expanded={expanded === pr.number}
        onToggle={() => setExpanded(current => current === pr.number ? undefined : pr.number)} />)}
    </ul>;
  }

  return <>
    <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
      <SearchBox value={search} onChange={setSearch} placeholder="Search title or #number" label="Search pull requests" />
      <Segmented label="Filter pull requests" value={state} onChange={setState} options={PR_FILTERS} />
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
    <Pager data={data} page={page} busy={busy} onPage={next => setPaging({ key: resultKey, page: next })} />
  </>;
}

function SearchBox({ value, onChange, placeholder, label }: { value: string; onChange: (value: string) => void; placeholder: string; label: string }) {
  return <div className="relative min-w-48 flex-1">
    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    <Input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} aria-label={label} maxLength={100}
      onKeyDown={event => { if (event.key === "Escape" && value) { event.preventDefault(); event.stopPropagation(); onChange(""); } }}
      className="h-9 pl-8 pr-8" />
    {value && <button type="button" onClick={() => onChange("")} aria-label="Clear search"
      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>}
  </div>;
}

/**
 * US-SY-04: commits and pull requests (with reviews) synchronized from GitHub
 * webhooks for the project's repository. Both lists refresh every 30 s while open.
 */
export function RepositoryActivitySheet({ open, onOpenChange, projectId, repositoryName }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  repositoryName: string;
}) {
  const [tab, setTab] = useState<Tab>("commits");
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-2xl">
      <SheetHeader className="gap-3 border-b px-5 pb-4 pt-5">
        <div className="flex items-center gap-3 pr-8">
          <GitHubTile size="sm" />
          <div className="min-w-0">
            <SheetTitle className="text-base">Repository activity</SheetTitle>
            <SheetDescription className="truncate text-xs">{repositoryName} · synchronized from GitHub as it happens</SheetDescription>
          </div>
        </div>
        <Segmented label="Activity" value={tab} onChange={setTab} options={[
          { id: "commits", label: <><GitCommitHorizontal className="size-3.5" aria-hidden="true" />Commits</> },
          { id: "pull-requests", label: <><GitPullRequest className="size-3.5" aria-hidden="true" />Pull requests</> },
        ]} />
      </SheetHeader>
      {tab === "commits" ? <CommitsTab projectId={projectId} active={open} /> : <PullRequestsTab projectId={projectId} active={open} />}
    </SheetContent>
  </Sheet>;
}
