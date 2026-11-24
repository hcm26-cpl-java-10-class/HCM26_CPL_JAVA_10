import { ChevronLeft, ChevronRight, RefreshCw, RotateCcw, Webhook } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirmdialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { GitWebhookEventItem, GitWebhookEventStatus } from "@/types/features/git-integration";
import { formatDateTime, formatRelative } from "../git-integration.format";
import { useReplayWebhookEvent, useWebhookEvents } from "../useGitIntegration";
import { WebhookStatusBadge } from "./SyncDataBadges";

const PAGE_SIZE = 15;

const FILTERS: Array<{ id: GitWebhookEventStatus | "ALL"; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "FAILED", label: "Failed" },
  { id: "FAILED_RETRYABLE", label: "Retrying" },
  { id: "IGNORED", label: "Ignored" },
  { id: "PROCESSED", label: "Processed" },
];

const EVENT_LABELS: Record<string, string> = {
  push: "Push",
  pull_request: "Pull request",
  pull_request_review: "Review",
  installation: "Installation",
  installation_repositories: "Installation repositories",
  repository: "Repository",
};

function eventLabel(event: GitWebhookEventItem) {
  const type = EVENT_LABELS[event.eventType] ?? event.eventType;
  return event.action ? `${type} · ${event.action.replaceAll("_", " ")}` : type;
}

/** Retry progress, processing time or why it gave up; null when nothing to add. */
function detail(event: GitWebhookEventItem): ReactNode {
  if (event.status === "FAILED_RETRYABLE") {
    return <>Retry {event.retryCount + 1} of {event.maxRetries}
      {event.nextRetryAt && <> · next <time dateTime={event.nextRetryAt} title={formatDateTime(event.nextRetryAt)}>{formatRelative(event.nextRetryAt)}</time></>}
    </>;
  }
  if (event.status === "PROCESSED" && event.latencyMs != null) return <>Processed in {event.latencyMs.toLocaleString("en")} ms</>;
  if (event.status === "FAILED") return <>Gave up after {event.retryCount} {event.retryCount === 1 ? "retry" : "retries"}</>;
  return null;
}

/**
 * US-SY-04: GitHub webhook deliveries of the organization and how each one was
 * processed (fast path, retries with backoff, ignored for unlinked repositories).
 * Failed events — and ignored activity events, e.g. pushed before the repository
 * was linked — can be processed again. Only for Git Integration managers.
 */
export function WebhookDeliveryLog() {
  const [status, setStatus] = useState<GitWebhookEventStatus | "ALL">("ALL");
  const [paging, setPaging] = useState({ key: status as string, page: 0 });
  const page = paging.key === status ? paging.page : 0;
  const query = useWebhookEvents({ status: status === "ALL" ? undefined : status, page, size: PAGE_SIZE });
  const replay = useReplayWebhookEvent();
  const [confirming, setConfirming] = useState<GitWebhookEventItem | null>(null);
  const data = query.data;
  const busy = query.isFetching && !query.isPending;

  function confirmReplay() {
    if (!confirming) return;
    replay.mutate(confirming.id, { onSettled: () => setConfirming(null) });
  }

  let body: ReactNode;
  if (query.isPending) {
    body = <div role="status" aria-label="Loading webhook deliveries" className="divide-y">
      {[0, 1, 2, 3].map(index => <div key={index} className="space-y-2 px-4 py-3"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div>)}
    </div>;
  } else if (query.isError) {
    body = <div role="alert" className="flex flex-col items-center gap-3 px-6 py-10 text-center text-sm text-muted-foreground">
      Webhook deliveries could not be loaded.
      <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>
        <RefreshCw className={query.isFetching ? "animate-spin" : undefined} />Try again
      </Button>
    </div>;
  } else if (data && data.items.length === 0) {
    body = <p className="px-6 py-10 text-center text-sm text-muted-foreground">
      {status === "ALL" ? "No webhook deliveries yet. They appear here as soon as GitHub sends activity." : "No deliveries with this status."}
    </p>;
  } else if (data) {
    body = <ul aria-label="Webhook deliveries" className={cn("divide-y transition-opacity", busy && "opacity-70")}>
      {data.items.map(event => { const extra = detail(event); return <li key={event.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3">
        <div className="min-w-0 flex-1 basis-64 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <WebhookStatusBadge status={event.status} />
            <span className="text-sm font-medium">{eventLabel(event)}</span>
            {event.repoFullName && <span className="truncate text-xs text-muted-foreground">{event.repoFullName}</span>}
          </div>
          <p className="flex flex-wrap gap-x-1.5 text-[11px] text-muted-foreground">
            <time dateTime={event.receivedAt} title={formatDateTime(event.receivedAt)}>Received {formatRelative(event.receivedAt)}</time>
            {event.senderLogin && <span>· by {event.senderLogin}</span>}
            {extra && <span>· {extra}</span>}
          </p>
          {event.note && <p className={cn("break-words text-[11px]", event.status === "FAILED" || event.status === "FAILED_RETRYABLE"
            ? "text-red-700 dark:text-red-300" : "text-muted-foreground")} title={event.note}>
            {event.note.length > 220 ? `${event.note.slice(0, 220)}…` : event.note}
          </p>}
        </div>
        {event.replayable && <Button variant="outline" size="sm" className="h-8 shrink-0" disabled={replay.isPending}
          onClick={() => setConfirming(event)} aria-label={`Process ${eventLabel(event)} event again`}>
          <RotateCcw />Replay
        </Button>}
      </li>; })}
    </ul>;
  }

  return <section id="webhook-deliveries" aria-labelledby="webhook-deliveries-title" className="space-y-2 scroll-mt-20">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div className="space-y-0.5">
        <h2 id="webhook-deliveries-title" className="flex items-center gap-1.5 text-sm font-semibold"><Webhook className="size-4" aria-hidden="true" />Webhook deliveries</h2>
        <p className="text-xs text-muted-foreground">Commits, pull requests and reviews are synchronized as GitHub sends them; failures retry automatically up to 5 times.</p>
      </div>
      <div role="group" aria-label="Filter webhook deliveries" className="inline-flex flex-wrap rounded-lg border bg-card p-0.5">
        {FILTERS.map(item => <button key={item.id} type="button" aria-pressed={status === item.id} onClick={() => setStatus(item.id)}
          className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            status === item.id ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-muted-foreground hover:text-foreground")}>
          {item.label}
        </button>)}
      </div>
    </div>

    <div className="overflow-hidden rounded-xl border bg-card">
      {body}
      {data && data.totalPages > 1 && <footer className="flex items-center justify-between gap-2 border-t px-4 py-2.5">
        <p className="text-xs text-muted-foreground" aria-live="polite">Page <span className="tabular-nums">{page + 1}</span> of <span className="tabular-nums">{data.totalPages}</span></p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8" disabled={page === 0 || busy} onClick={() => setPaging({ key: status, page: page - 1 })}><ChevronLeft />Prev</Button>
          <Button variant="outline" size="sm" className="h-8" disabled={page + 1 >= data.totalPages || busy} onClick={() => setPaging({ key: status, page: page + 1 })}>Next<ChevronRight /></Button>
        </div>
      </footer>}
    </div>

    <ConfirmDialog open={confirming !== null} title="Process this event again?"
      description={confirming && <>The <span className="font-medium text-foreground">{eventLabel(confirming)}</span> event
        {confirming.repoFullName && <> from <span className="font-medium text-foreground">{confirming.repoFullName}</span></>} gets a fresh set of retries.
        Data already stored is never duplicated.</>}
      confirmLabel="Replay" loadingLabel="Queuing…" destructive={false} loading={replay.isPending}
      onConfirm={confirmReplay} onCancel={() => setConfirming(null)} />
  </section>;
}
