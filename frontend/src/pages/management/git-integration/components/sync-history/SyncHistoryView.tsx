import { History, RefreshCw, RotateCcw } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  GitRepositoryLabel, GitSyncHistoryItem, GitSyncHistoryStatus, GitSyncHistoryType,
} from "@/types/features/git-integration";
import { gitIntegrationHttpStatus } from "@/api/features/git-integration.api";
import { formatDateTime, formatRelative } from "../../git-integration.format";
import type { GitHubTabPatch, GitHubTabState } from "../../github-tab.params";
import { useRetrySyncHistoryWebhook, useSyncHistory } from "../../useGitIntegration";
import { EmptyState, ErrorState, ListSkeleton, Pager } from "../activity/ActivityControls";
import { SyncStatusBadge, SyncTypeBadge } from "./SyncHistoryBadges";
import {
  SYNC_STATUS_LABELS, SYNC_TYPE_LABELS, entryKey, formatCount, formatDuration, summaryLine,
} from "./sync-history.format";
import { SyncHistoryDetailSheet } from "./SyncHistoryDetailSheet";

const PAGE_SIZE = 20;
const ALL = "ALL";
const TYPES = Object.keys(SYNC_TYPE_LABELS) as GitSyncHistoryType[];
const STATUSES = Object.keys(SYNC_STATUS_LABELS) as GitSyncHistoryStatus[];

function FilterSelect<T extends string>({ label, value, options, labels, allLabel, onChange }: {
  label: string;
  value?: T;
  options: T[];
  labels: Record<T, string>;
  allLabel: string;
  onChange: (value: T | undefined) => void;
}) {
  return <Select value={value ?? ALL} onValueChange={next => onChange(next === ALL ? undefined : next as T)}>
    <SelectTrigger size="sm" aria-label={label} className="h-8 min-w-32 text-xs"><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value={ALL}>{allLabel}</SelectItem>
      {options.map(option => <SelectItem key={option} value={option}>{labels[option]}</SelectItem>)}
    </SelectContent>
  </Select>;
}

function RepositorySelect({ repositories, value, onChange }: {
  repositories: GitRepositoryLabel[];
  value?: number | null;
  onChange: (repo: number) => void;
}) {
  if (repositories.length < 2 || value == null) return null;
  return <Select value={String(value)} onValueChange={next => onChange(Number(next))}>
    <SelectTrigger size="sm" aria-label="Repository" className="h-8 max-w-64 text-xs"><SelectValue /></SelectTrigger>
    <SelectContent align="end">
      {repositories.map(repository => <SelectItem key={repository.id} value={String(repository.id)}>
        {repository.fullName}{repository.status === "INACTIVE" ? " (unlinked)" : repository.status === "DISCONNECTED" ? " (disconnected)" : ""}
      </SelectItem>)}
    </SelectContent>
  </Select>;
}

function HistoryRow({ item, onOpen, retrying, onRetry }: {
  item: GitSyncHistoryItem;
  onOpen: () => void;
  retrying: boolean;
  onRetry: () => void;
}) {
  const summary = summaryLine(item);
  const failed = item.status === "FAILED" || item.status === "PARTIAL_SUCCESS";
  return <li className="flex items-stretch">
    <button type="button" onClick={onOpen}
      className="flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none sm:grid sm:grid-cols-[minmax(0,1fr)_6.5rem_8.5rem_4.5rem_4.5rem] sm:items-center sm:gap-3 sm:px-5">
      <span className="min-w-0 space-y-0.5">
        <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
          <time dateTime={item.occurredAt} title={formatDateTime(item.occurredAt)}>{formatRelative(item.occurredAt)}</time>
        </span>
        {summary && <span className={cn("line-clamp-2 block break-words text-xs",
          failed ? "text-red-700 dark:text-red-300" : "text-muted-foreground")}>{summary}</span>}
      </span>
      <span className="flex flex-wrap items-center gap-1.5 sm:contents">
        <span><SyncTypeBadge type={item.type} /></span>
        <span><SyncStatusBadge status={item.status} /></span>
        <span className="text-xs tabular-nums text-muted-foreground sm:text-right sm:text-sm sm:text-foreground">
          <span className="sm:hidden">Records </span>{formatCount(item.recordsProcessed)}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground sm:text-right">
          <span className="sm:hidden">· </span>{formatDuration(item.durationMs)}
        </span>
      </span>
    </button>
    <span className="flex w-24 shrink-0 items-center justify-center border-l border-transparent pr-3 sm:pr-4">
      {item.canRetry && <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={retrying} onClick={onRetry}
        aria-label={`Retry the failed ${item.eventType ?? "webhook"} delivery`}>
        <RotateCcw className={cn(retrying && "animate-spin motion-reduce:animate-none")} />Retry
      </Button>}
    </span>
  </li>;
}

/**
 * US-SY-06: Synchronization history of the project's repository (AC01–AC04), in the workspace
 * GitHub tab (`?tab=github&view=history`). Filters, page and the opened entry live in the URL.
 */
export function SyncHistoryView({ projectId, state, onChange, canLink }: {
  projectId: number;
  state: GitHubTabState;
  onChange: (patch: GitHubTabPatch) => void;
  canLink: boolean;
}) {
  const { type, status, page, repo, entry } = state;
  const query = useSyncHistory(projectId, { type, status, repositoryId: repo, page, size: PAGE_SIZE });
  const retry = useRetrySyncHistoryWebhook(projectId);
  const top = useRef<HTMLDivElement>(null);
  const data = query.data;
  const busy = query.isFetching && !query.isPending;
  const filtered = !!(type || status);
  const running = data?.items.some(item => item.status === "PENDING" || item.status === "PROCESSING");
  const clear = () => onChange({ type: undefined, status: undefined });

  let body: ReactNode;
  if (query.isPending) body = <ListSkeleton />;
  else if (query.isError) {
    body = gitIntegrationHttpStatus(query.error) === 403
      ? <EmptyState>Only the project manager can view the synchronization history.</EmptyState>
      : <ErrorState retrying={query.isFetching} onRetry={() => void query.refetch()} message="The synchronization history could not be loaded." />;
  } else if (data && !data.hasRepository) {
    body = <EmptyState>{canLink ? "Link a repository to start synchronizing. Each synchronization will be listed here."
      : "No repository is linked to this project yet."}</EmptyState>;
  } else if (data && data.items.length === 0) {
    body = page > 0 && data.totalElements > 0
      ? <EmptyState action={<Button variant="outline" size="sm" onClick={() => onChange({ page: 0 })}>Go to the first page</Button>}>This page is empty.</EmptyState>
      : filtered
        ? <EmptyState action={<Button variant="outline" size="sm" onClick={clear}>Clear filters</Button>}>No synchronizations match these filters.</EmptyState>
        : <div role="status" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <History className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">No synchronization history yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Each synchronization with GitHub (the first import, Sync now, the periodic reconcile and webhooks) will be listed here.
          </p>
        </div>;
  } else if (data) {
    body = <div className={cn("transition-opacity", busy && "opacity-70")}>
      <div aria-hidden="true" className="hidden border-b bg-slate-50/80 px-5 py-1.5 text-[11px] font-semibold text-muted-foreground dark:bg-muted/60 sm:flex">
        <span className="grid flex-1 grid-cols-[minmax(0,1fr)_6.5rem_8.5rem_4.5rem_4.5rem] gap-3">
          <span>Time</span><span>Type</span><span>Status</span><span className="text-right">Records</span><span className="text-right">Duration</span>
        </span>
        <span className="w-24 shrink-0" />
      </div>
      <ul className="divide-y">
        {data.items.map(item => <HistoryRow key={entryKey(item)} item={item}
          onOpen={() => onChange({ entry: entryKey(item) })}
          retrying={retry.isPending && retry.variables === item.id}
          onRetry={() => retry.mutate(item.id)} />)}
      </ul>
    </div>;
  }

  return <section aria-label="Synchronization history" className="min-w-0">
    <div ref={top} className="flex scroll-mt-4 flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-5">
      <FilterSelect label="Type" value={type} options={TYPES} labels={SYNC_TYPE_LABELS} allLabel="All types"
        onChange={value => onChange({ type: value })} />
      <FilterSelect label="Status" value={status} options={STATUSES} labels={SYNC_STATUS_LABELS} allLabel="All statuses"
        onChange={value => onChange({ status: value })} />
      <span className="ml-auto flex flex-wrap items-center gap-2">
        {running && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" aria-live="polite">
          <RefreshCw className="size-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />Updating automatically
        </span>}
        {data && <RepositorySelect repositories={data.repositories} value={data.repositoryId}
          onChange={next => onChange({ repo: next, entry: undefined })} />}
      </span>
    </div>
    {body}
    <Pager data={data} page={page} busy={busy} onPage={next => {
      onChange({ page: next });
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }} />
    <SyncHistoryDetailSheet projectId={projectId} entry={entry} onClose={() => onChange({ entry: undefined })} />
  </section>;
}
