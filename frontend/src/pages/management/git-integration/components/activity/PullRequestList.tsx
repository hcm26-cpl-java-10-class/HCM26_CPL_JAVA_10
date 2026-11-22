import { useMediaQuery } from "@uidotdev/usehooks";
import { MousePointerClick } from "lucide-react";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { GitPullRequestItem, GitPullRequestState, GitTaskRef } from "@/types/features/git-integration";
import type { GitHubTabPatch, GitHubTabState } from "../../github-tab.params";
import { formatDateTime, formatRelative } from "../../git-integration.format";
import { syncInProgress, useProjectRepository, useRepositoryPullRequests } from "../../useGitIntegration";
import { pullRequestAccent } from "../git-integration.styles";
import { PullRequestStateBadge } from "../SyncDataBadges";
import { RepositoryLabelChip } from "../RepositoryManagement";
import { TaskRefChips } from "../TaskRefChips";
import { EmptyState, ErrorState, ListSkeleton, Pager, SearchBox, Segmented } from "./ActivityControls";
import { PullRequestDetail } from "./PullRequestDetail";

const PAGE_SIZE = 20;
const LARGE = "(min-width: 1024px)";

const PR_FILTERS: Array<{ id: GitPullRequestState | "ALL"; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "OPEN", label: "Open" },
  { id: "MERGED", label: "Merged" },
  { id: "CLOSED", label: "Closed" },
];

function PullRequestRow({ pr, selected, onSelect, onOpenTask }: {
  pr: GitPullRequestItem;
  selected: boolean;
  onSelect: () => void;
  onOpenTask: (ref: GitTaskRef) => void;
}) {
  const summary = pr.reviewSummary;
  return <li className={cn(pullRequestAccent(pr.state, pr.draft), selected ? "bg-muted/60" : "hover:bg-muted/30")}>
    <button type="button" data-pr-row={pr.number} aria-current={selected ? "true" : undefined} onClick={onSelect}
      className="block w-full py-3 pl-[14px] pr-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:pl-[18px] sm:pr-5">
      <span className="flex flex-wrap items-center gap-1.5">
        <PullRequestStateBadge state={pr.state} draft={pr.draft} />
        <span className="min-w-0 break-words text-sm font-medium leading-5"><span className="text-muted-foreground">#{pr.number}</span> {pr.title}</span>
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
        <span>{pr.authorLogin ?? "Unknown author"}</span>
        {pr.headRef && <span className="max-w-48 truncate font-mono">· {pr.headRef}</span>}
        <span>· updated <time dateTime={pr.updatedAt} title={formatDateTime(pr.updatedAt)}>{formatRelative(pr.updatedAt)}</time></span>
        {(pr.repository?.status === "INACTIVE" || pr.repository?.status === "DISCONNECTED") && <RepositoryLabelChip repository={pr.repository} />}
        {pr.additions != null && pr.deletions != null && <span>· <span className="text-emerald-700 dark:text-emerald-400">+{pr.additions}</span> <span className="text-red-700 dark:text-red-400">−{pr.deletions}</span></span>}
      </span>
      {(summary.approved > 0 || summary.changesRequested > 0) && <span className="mt-1 flex flex-wrap gap-x-2 text-[11px]">
        {summary.approved > 0 && <span className="text-emerald-700 dark:text-emerald-400">✓ {summary.approved} approved</span>}
        {summary.changesRequested > 0 && <span className="text-red-700 dark:text-red-400">✗ {summary.changesRequested} changes requested</span>}
      </span>}
    </button>
    {/* Chips sit outside the row button so a linked task can be opened without selecting the PR. */}
    {(pr.taskRefs ?? []).length > 0 && <div className="-mt-1.5 pb-3 pl-[14px] pr-4 sm:pl-[18px] sm:pr-5"><TaskRefChips refs={pr.taskRefs} onOpen={onOpenTask} /></div>}
  </li>;
}

type PullRequestFilters = Pick<GitHubTabState, "q" | "state" | "pr" | "page" | "repo">;

/**
 * WS-GH-01: pull requests as master–detail. On large screens the detail of the selected
 * pull request (or the first one) sits on the right; on smaller ones it opens in a sheet.
 * ↑/↓ (or j/k) move the selection while the list has focus.
 */
export function PullRequestsView({ projectId, filters, onChange, onOpenTask }: {
  projectId: number;
  filters: PullRequestFilters;
  onChange: (patch: GitHubTabPatch) => void;
  onOpenTask: (ref: GitTaskRef) => void;
}) {
  const { q, state, pr, page, repo } = filters;
  // US-SY-02 AC05: an empty list while the first import runs says so instead of "No pull requests yet".
  const repository = useProjectRepository(projectId);
  const importing = syncInProgress(repository.data) && (repository.data?.repository?.pullRequestCount ?? 0) === 0;
  const large = useMediaQuery(LARGE);
  const query = useRepositoryPullRequests(projectId, { q: q || undefined, state, page, size: PAGE_SIZE, repositoryId: repo });
  const top = useRef<HTMLDivElement>(null);
  const data = query.data;
  const items = data?.items ?? [];
  const busy = query.isFetching && !query.isPending;
  // Large screens always show a detail: the chosen pull request, else the first of the page.
  const selected = pr ?? (large ? items[0]?.number : undefined);
  // US-GI-05: a number is unique within one repository only; the listed one decides which repository.
  const selectedRepositoryId = repo ?? items.find(item => item.number === selected)?.repository?.id;
  const select = (number: number) => onChange({ pr: number });

  function onListKey(event: KeyboardEvent<HTMLUListElement>) {
    const step = event.key === "ArrowDown" || event.key === "j" ? 1 : event.key === "ArrowUp" || event.key === "k" ? -1 : 0;
    if (step === 0 || items.length === 0) return;
    event.preventDefault();
    const index = items.findIndex(item => item.number === selected);
    const next = items[Math.min(Math.max(index + step, 0), items.length - 1)];
    select(next.number);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-pr-row="${next.number}"]`)?.focus();
  }

  let body: ReactNode;
  if (query.isPending) body = <ListSkeleton />;
  else if (query.isError) body = <ErrorState retrying={query.isFetching} onRetry={() => void query.refetch()} />;
  else if (items.length === 0) {
    body = page > 0 && (data?.totalElements ?? 0) > 0
      ? <EmptyState action={<Button variant="outline" size="sm" onClick={() => onChange({ page: 0 })}>Go to the first page</Button>}>This page is empty.</EmptyState>
      : q || state
        ? <EmptyState action={<Button variant="outline" size="sm" onClick={() => onChange({ q: "", state: undefined })}>Clear filters</Button>}>No pull requests match these filters.</EmptyState>
        : importing
          ? <EmptyState>Importing pull requests and reviews from GitHub…</EmptyState>
          : <EmptyState>
            No pull requests yet.
            <span className="mt-1 block text-xs">Pull requests opened on GitHub appear here automatically.</span>
          </EmptyState>;
  } else {
    body = <ul aria-label="Pull requests" onKeyDown={onListKey} className={cn("divide-y transition-opacity", busy && "opacity-70")}>
      {items.map(item => <PullRequestRow key={item.id} pr={item} selected={item.number === selected} onSelect={() => select(item.number)} onOpenTask={onOpenTask} />)}
    </ul>;
  }

  const list = <div className="min-w-0">
    <div ref={top} className="flex scroll-mt-4 flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-5">
      <SearchBox value={q} onCommit={value => onChange({ q: value })} placeholder="Search title or #number" label="Search pull requests" />
      <Segmented label="Filter pull requests" value={state ?? "ALL"} options={PR_FILTERS}
        onChange={value => onChange({ state: value === "ALL" ? undefined : value })} />
    </div>
    {body}
    <Pager data={data} page={page} busy={busy} onPage={next => {
      onChange({ page: next });
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }} />
  </div>;

  if (large) {
    return <section aria-label="Pull requests" className="grid min-w-0 grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {list}
      <div className="min-w-0 border-l">
        <div className="sticky top-0 max-h-[calc(100dvh-7rem)] overflow-y-auto">
          {selected !== undefined
            ? <PullRequestDetail key={selected} projectId={projectId} number={selected} repositoryId={selectedRepositoryId} onOpenTask={onOpenTask}
              onClose={pr !== undefined ? () => onChange({ pr: undefined }) : undefined} />
            : <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-muted-foreground">
              <MousePointerClick className="size-5" aria-hidden="true" />Select a pull request to see its reviews and linked tasks.
            </div>}
        </div>
      </div>
    </section>;
  }

  return <section aria-label="Pull requests" className="min-w-0">
    {list}
    <Sheet open={pr !== undefined} onOpenChange={open => { if (!open) onChange({ pr: undefined }); }}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="sr-only">
          <SheetTitle>Pull request #{pr}</SheetTitle>
          <SheetDescription>Reviews, linked tasks and description</SheetDescription>
        </SheetHeader>
        <div className="pt-8">
          {pr !== undefined && <PullRequestDetail key={pr} projectId={projectId} number={pr} repositoryId={selectedRepositoryId} onOpenTask={onOpenTask}
            onClose={() => onChange({ pr: undefined })} />}
        </div>
      </SheetContent>
    </Sheet>
  </section>;
}
