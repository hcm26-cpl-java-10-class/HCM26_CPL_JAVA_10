import type {
  GitSyncHistoryItem, GitSyncHistorySource, GitSyncHistoryStatus, GitSyncHistoryType,
} from "@/types/features/git-integration";
import { syncErrorMessage } from "../../git-integration.messages";

/** US-SY-06 BR3: the four kinds of synchronization. */
export const SYNC_TYPE_LABELS: Record<GitSyncHistoryType, string> = {
  INITIAL: "Initial",
  MANUAL: "Manual",
  RECONCILE: "Reconcile",
  WEBHOOK: "Webhook",
};

/** BR4: the five statuses of a synchronization. */
export const SYNC_STATUS_LABELS: Record<GitSyncHistoryStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  SUCCESS: "Success",
  PARTIAL_SUCCESS: "Partial success",
  FAILED: "Failed",
};

const NUMBER = new Intl.NumberFormat("en-US");
const TIME = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

export function formatCount(value?: number | null) {
  return value == null ? "—" : NUMBER.format(value);
}

/** 850 ms → "< 1 s", 12 s, 3 min 5 s, 1 h 4 min. */
export function formatDuration(ms?: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return "< 1 s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return seconds % 60 && minutes < 10 ? `${minutes} min ${seconds % 60} s` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
}

export function formatClock(value?: string | null) {
  return value ? TIME.format(new Date(value)) : "";
}

/** `job-12` / `webhook-80`: the entry opened in the side panel (kept in the URL). */
export function entryKey(item: Pick<GitSyncHistoryItem, "source" | "id">) {
  return `${item.source.toLowerCase()}-${item.id}`;
}

export function parseEntry(entry?: string): { source: GitSyncHistorySource; id: number } | undefined {
  const match = entry?.match(/^(job|webhook)-(\d+)$/);
  return match ? { source: match[1] === "job" ? "JOB" : "WEBHOOK", id: Number(match[2]) } : undefined;
}

const EVENT_LABELS: Record<string, string> = {
  push: "Push",
  pull_request: "Pull request",
  pull_request_review: "Review",
};

/** "Push", "Pull request · opened". */
export function eventLabel(eventType?: string | null, action?: string | null) {
  const name = (eventType && EVENT_LABELS[eventType]) ?? eventType ?? "Webhook";
  return action ? `${name} · ${action.replaceAll("_", " ")}` : name;
}

/** One line under the time: what it was, and what went wrong or what it waits for. */
export function summaryLine(item: GitSyncHistoryItem) {
  const parts: string[] = [];
  if (item.source === "WEBHOOK") parts.push(eventLabel(item.eventType, item.action));
  if (item.status === "PENDING") parts.push("Waiting to start");
  if (item.retryAt) parts.push(`Retrying at ${formatClock(item.retryAt)}`);
  if (item.source === "WEBHOOK" && item.error) parts.push(item.error);
  if (item.source === "JOB" && item.errorCode && item.status !== "PENDING") parts.push(syncErrorMessage(item.errorCode));
  return parts.join(" · ");
}
