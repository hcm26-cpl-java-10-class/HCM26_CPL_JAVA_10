import type { GitPullRequestItem } from "@/types/features/git-integration";

/**
 * WS-GH-01: why an open pull request needs someone's attention, most urgent first.
 * - CHANGES_REQUESTED: a reviewer's current decision asks for changes (the author must act).
 * - AWAITING_REVIEW: ready for review (not a draft) and nobody has approved or asked for changes yet.
 * - STALE: no update for more than {@link STALE_DAYS} days (drafts included).
 */
export type PullRequestAttention = "CHANGES_REQUESTED" | "AWAITING_REVIEW" | "STALE";

export const STALE_DAYS = 3;
const DAY_MS = 24 * 3600 * 1000;
const RANK: Record<PullRequestAttention, number> = { CHANGES_REQUESTED: 0, AWAITING_REVIEW: 1, STALE: 2 };

function time(value?: string | null) {
  const parsed = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function attentionOf(pr: GitPullRequestItem, now: number = Date.now()): PullRequestAttention | null {
  if (pr.state !== "OPEN") return null;
  if (pr.reviewSummary.changesRequested > 0) return "CHANGES_REQUESTED";
  if (!pr.draft && pr.reviewSummary.approved === 0) return "AWAITING_REVIEW";
  if (now - time(pr.updatedAt) > STALE_DAYS * DAY_MS) return "STALE";
  return null;
}

export interface AttentionItem {
  pr: GitPullRequestItem;
  reason: PullRequestAttention;
}

/** Open pull requests that need attention: by reason, then the one waiting longest first. */
export function pullRequestsNeedingAttention(items: GitPullRequestItem[], now: number = Date.now()): AttentionItem[] {
  return items
    .map(pr => ({ pr, reason: attentionOf(pr, now) }))
    .filter((item): item is AttentionItem => item.reason !== null)
    .sort((a, b) => RANK[a.reason] - RANK[b.reason] || time(a.pr.updatedAt) - time(b.pr.updatedAt));
}
