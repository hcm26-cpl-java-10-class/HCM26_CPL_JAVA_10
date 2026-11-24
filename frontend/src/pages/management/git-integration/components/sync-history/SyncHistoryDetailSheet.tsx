import { AlertCircle, Info, RefreshCw, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { GitSyncHistoryDetail } from "@/types/features/git-integration";
import { gitIntegrationHttpStatus } from "@/api/features/git-integration.api";
import { formatDateTime } from "../../git-integration.format";
import { retryBlockedMessage, syncErrorMessage } from "../../git-integration.messages";
import { useRetrySync, useRetrySyncHistoryWebhook, useSyncHistoryEntry } from "../../useGitIntegration";
import { SyncStatusBadge } from "./SyncHistoryBadges";
import { SYNC_TYPE_LABELS, eventLabel, formatClock, formatCount, formatDuration, parseEntry } from "./sync-history.format";

const PHASES: Record<string, string> = {
  METADATA: "Checking the repository",
  COMMITS: "Importing commits",
  BRANCHES: "Importing other branches",
  PULL_REQUESTS: "Importing pull requests",
  DONE: "Finished",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-1.5 text-sm">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words">{children}</dd>
  </div>;
}

function Time({ value }: { value?: string | null }) {
  return value ? <time dateTime={value}>{formatDateTime(value)}</time> : <span className="text-muted-foreground">—</span>;
}

/** Job: what each step stored (AC02). */
function Breakdown({ detail }: { detail: GitSyncHistoryDetail }) {
  const b = detail.breakdown;
  if (!b) return null;
  const rows: Array<{ label: string; values: Array<[string, number | null | undefined]> }> = [
    { label: "Commits", values: [["new", b.commitsInserted], ["already stored", b.commitsExisting]] },
    { label: "Branch commits", values: [["new", b.branchCommitsInserted], ["already stored", b.branchCommitsExisting]] },
    { label: "Branches", values: [["read", b.branchesSynced], ["unchanged", b.branchesSkipped], ["partly imported", b.branchesPartial], ["deleted", b.branchesDeleted]] },
    { label: "Pull requests", values: [["new", b.pullRequestsInserted], ["updated", b.pullRequestsUpdated], ["unchanged", b.pullRequestsUnchanged]] },
    { label: "Reviews", values: [["new", b.reviewsInserted], ["updated", b.reviewsUpdated]] },
  ];
  const shown = rows.filter(row => row.values.some(([, value]) => value != null));
  if (shown.length === 0) return null;
  return <table className="w-full text-sm">
    <caption className="sr-only">Records processed by step</caption>
    <tbody className="divide-y">
      {shown.map(row => <tr key={row.label}>
        <th scope="row" className="py-1.5 pr-3 text-left font-normal text-muted-foreground">{row.label}</th>
        <td className="py-1.5 text-right tabular-nums">
          {row.values.filter(([, value]) => value != null).map(([label, value]) => `${formatCount(value)} ${label}`).join(" · ")}
        </td>
      </tr>)}
    </tbody>
  </table>;
}

function ErrorBox({ detail }: { detail: GitSyncHistoryDetail }) {
  const error = detail.error;
  if (!error || (!error.code && !error.message)) return null;
  const { item } = detail;
  const waiting = item.status === "PROCESSING";
  const friendly = error.code ? syncErrorMessage(error.code) : error.message;
  return <div role={waiting ? "status" : "alert"} className={cn("space-y-1.5 rounded-lg border px-3 py-2.5 text-sm",
    waiting ? "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-100"
      : item.status === "PARTIAL_SUCCESS" ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
        : "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100")}>
    <p className="flex items-start gap-2 font-medium">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{waiting ? "The last attempt failed" : item.status === "PARTIAL_SUCCESS" ? "Not everything could be read" : "What went wrong"}</span>
    </p>
    <p className="break-words">{friendly}</p>
    {waiting && item.retryAt && <p className="text-xs opacity-90">It is tried again automatically at {formatClock(item.retryAt)}.</p>}
    {error.code && error.message && <details className="text-xs">
      <summary className="cursor-pointer opacity-80 hover:opacity-100">Technical details</summary>
      <p className="mt-1 break-words font-mono">{error.code}: {error.message}</p>
    </details>}
  </div>;
}

/**
 * US-SY-06 AC02: one synchronization in a side panel (`&entry=job-12`): when, records processed
 * (by step for a job), the error, and what the PM can do (AC04 Retry, or Sync again).
 */
export function SyncHistoryDetailSheet({ projectId, entry, onClose }: {
  projectId: number;
  entry?: string;
  onClose: () => void;
}) {
  const target = parseEntry(entry);
  const query = useSyncHistoryEntry(projectId, target?.source, target?.id);
  const retry = useRetrySyncHistoryWebhook(projectId);
  const syncAgain = useRetrySync(projectId);
  const detail = query.data;
  const item = detail?.item;
  const title = !item ? "Synchronization"
    : item.source === "WEBHOOK" ? `Webhook · ${eventLabel(item.eventType, item.action)}` : `${SYNC_TYPE_LABELS[item.type]} sync`;

  let body: ReactNode;
  if (query.isPending) {
    body = <div role="status" aria-label="Loading" className="space-y-3"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-24 w-full" /></div>;
  } else if (query.isError || !detail || !item) {
    body = <div role="alert" className="space-y-3 text-sm text-muted-foreground">
      <p>{gitIntegrationHttpStatus(query.error) === 404 ? "This synchronization is not part of this project." : "The synchronization could not be loaded."}</p>
      <Button variant="outline" size="sm" onClick={() => void query.refetch()}><RefreshCw />Try again</Button>
    </div>;
  } else {
    const webhook = detail.webhook;
    const job = detail.job;
    const blocked = webhook && item.status === "FAILED" ? retryBlockedMessage(webhook.retryBlockedReason) : null;
    body = <div className="space-y-5">
      <dl className="divide-y">
        <Field label="Status"><SyncStatusBadge status={item.status} /></Field>
        <Field label="Type">{SYNC_TYPE_LABELS[item.type]}</Field>
        {item.repository && <Field label="Repository">{item.repository.fullName}{item.repository.status === "INACTIVE" ? " (unlinked)" : ""}</Field>}
        <Field label={item.source === "WEBHOOK" ? "Received" : "Queued"}><Time value={item.occurredAt} /></Field>
        <Field label="Started"><Time value={item.startedAt} /></Field>
        <Field label="Finished"><Time value={item.finishedAt} /></Field>
        <Field label="Duration">{formatDuration(item.durationMs)}</Field>
        <Field label="Attempts">
          {item.attempts}{job ? ` of ${job.maxAttempts}` : webhook ? ` (up to ${webhook.maxRetries + 1})` : ""}
        </Field>
        <Field label="Records">
          <span className="font-medium tabular-nums">{formatCount(item.recordsProcessed)}</span>
          {item.recordsProcessed == null && <span className="ml-1 text-xs text-muted-foreground">
            {item.status === "PENDING" || item.status === "PROCESSING" ? "(not finished yet)" : "(not recorded)"}
          </span>}
        </Field>
        {job && <Field label="Step reached">{PHASES[job.phase] ?? job.phase}</Field>}
        {job?.requestedBy && <Field label="Started by">{job.requestedBy.name ?? `User #${job.requestedBy.id}`}</Field>}
        {job?.resumedFromJobId && <Field label="Continues">The stopped synchronization #{job.resumedFromJobId}</Field>}
        {webhook?.senderLogin && <Field label="GitHub user">@{webhook.senderLogin}</Field>}
        {webhook && <Field label="Delivery"><span className="font-mono text-xs">{webhook.deliveryId}</span></Field>}
      </dl>

      <Breakdown detail={detail} />
      <ErrorBox detail={detail} />
      {detail.note && <p className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><span className="break-words">{detail.note}</span>
      </p>}

      {item.canRetry && <div className="space-y-1.5">
        <Button size="sm" disabled={retry.isPending} onClick={() => retry.mutate(item.id)}>
          <RotateCcw className={cn(retry.isPending && "animate-spin motion-reduce:animate-none")} />Retry
        </Button>
        <p className="text-xs text-muted-foreground">Processes this delivery again. Data already stored is not duplicated.</p>
      </div>}
      {blocked && <p className="text-xs text-muted-foreground">Retry is not available: {blocked}</p>}
      {job?.canSyncAgain && <div className="space-y-1.5">
        <Button size="sm" variant="outline" disabled={syncAgain.isPending} onClick={() => syncAgain.mutate()}>
          <RefreshCw className={cn(syncAgain.isPending && "animate-spin motion-reduce:animate-none")} />Sync again
        </Button>
        <p className="text-xs text-muted-foreground">Starts a new synchronization that continues where this one stopped.</p>
      </div>}
    </div>;
  }

  return <Sheet open={!!target} onOpenChange={open => { if (!open) onClose(); }}>
    <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
      <SheetHeader className="border-b px-5 py-4">
        <SheetTitle className="pr-6">{title}</SheetTitle>
        <SheetDescription>
          {item ? `Synchronization details${item.repository ? ` · ${item.repository.fullName}` : ""}` : "Synchronization details"}
        </SheetDescription>
      </SheetHeader>
      <div className="px-5 py-4">{body}</div>
    </SheetContent>
  </Sheet>;
}
