import {
  CheckCircle2,
  Circle,
  CircleDashed,
  CircleSlash,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Loader2,
  MessageSquare,
  RotateCcw,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GitPullRequestState, GitReviewState, GitWebhookEventStatus } from "@/types/features/git-integration";

interface BadgeStyle {
  label: string;
  icon: LucideIcon;
  className: string;
  spin?: boolean;
}

const BASE = "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium";

const NEUTRAL = "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
const GREEN = "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";
const PURPLE = "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300";
const RED = "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300";
const AMBER = "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300";
const BLUE = "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300";

function Badge({ style }: { style: BadgeStyle }) {
  const Icon = style.icon;
  return <span className={cn(BASE, style.className)}>
    <Icon className={cn("size-3.5", style.spin && "animate-spin")} aria-hidden="true" />{style.label}
  </span>;
}

const PULL_REQUEST: Record<GitPullRequestState, BadgeStyle> = {
  OPEN: { label: "Open", icon: GitPullRequest, className: GREEN },
  MERGED: { label: "Merged", icon: GitMerge, className: PURPLE },
  CLOSED: { label: "Closed", icon: GitPullRequestClosed, className: RED },
};

/** US-SY-04: pull request state, the GitHub way (text + icon, colour is only a hint). */
export function PullRequestStateBadge({ state, draft }: { state: GitPullRequestState; draft?: boolean }) {
  if (state === "OPEN" && draft) return <Badge style={{ label: "Draft", icon: GitPullRequestDraft, className: NEUTRAL }} />;
  return <Badge style={PULL_REQUEST[state]} />;
}

const REVIEW: Record<GitReviewState, BadgeStyle> = {
  APPROVED: { label: "Approved", icon: CheckCircle2, className: GREEN },
  CHANGES_REQUESTED: { label: "Changes requested", icon: XCircle, className: RED },
  COMMENTED: { label: "Commented", icon: MessageSquare, className: NEUTRAL },
  DISMISSED: { label: "Dismissed", icon: CircleSlash, className: NEUTRAL },
  PENDING: { label: "Pending", icon: CircleDashed, className: NEUTRAL },
};

export function ReviewStateBadge({ state }: { state: GitReviewState }) {
  return <Badge style={REVIEW[state]} />;
}

const WEBHOOK_STATUS: Record<GitWebhookEventStatus, BadgeStyle> = {
  RECEIVED: { label: "Received", icon: Circle, className: BLUE },
  PROCESSING: { label: "Processing", icon: Loader2, className: BLUE, spin: true },
  PROCESSED: { label: "Processed", icon: CheckCircle2, className: GREEN },
  IGNORED: { label: "Ignored", icon: CircleSlash, className: NEUTRAL },
  FAILED_RETRYABLE: { label: "Retrying", icon: RotateCcw, className: AMBER },
  FAILED: { label: "Failed", icon: XCircle, className: RED },
};

/** US-SY-04: processing state of a webhook delivery. */
export function WebhookStatusBadge({ status }: { status: GitWebhookEventStatus }) {
  return <Badge style={WEBHOOK_STATUS[status]} />;
}
