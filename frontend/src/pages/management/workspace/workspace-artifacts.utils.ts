import type { MilestoneListItem, MilestonePageResponse } from "@/types";

export const ARTIFACT_REVIEW_STATES = {
  ACCEPTED: { label: "Accepted", tone: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" },
  REJECTED: { label: "Rejected", tone: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300" },
  CHANGES_REQUESTED: { label: "Changes requested", tone: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300" },
  SUBMITTED: { label: "Awaiting review", tone: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300" },
  DRAFT: { label: "Draft", tone: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" },
  NONE: { label: "Not submitted", tone: "border-border bg-muted/40 text-muted-foreground" },
  UNKNOWN: { label: "Unknown", tone: "border-border bg-muted/40 text-muted-foreground" },
} as const;

export type ArtifactReviewState = keyof typeof ARTIFACT_REVIEW_STATES;

export function artifactReviewState(status: string | null | undefined): ArtifactReviewState {
  if (status == null) return "NONE";
  const normalized = status.trim().replaceAll(/\s+/g, "_");
  return Object.hasOwn(ARTIFACT_REVIEW_STATES, normalized) && normalized !== "NONE"
    ? normalized as ArtifactReviewState : "UNKNOWN";
}

/** Preserve the existing browser-local timezone, using English UI labels. */
export function artifactDeadline(value: string | null | undefined, now = Date.now()) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return { date, label: date.toLocaleString("en-GB"), past: now > date.getTime() };
}

/** Filters run only after every API page has loaded, never on a truncated page. */
export async function loadAllArtifactMilestones(
  loadPage: (page: number) => Promise<MilestonePageResponse>,
): Promise<MilestoneListItem[]> {
  const items = new Map<string, MilestoneListItem>();
  let page = 0;
  let hasNext = true;
  while (hasNext) {
    const response = await loadPage(page);
    const previousSize = items.size;
    response.content.forEach(item => items.set(item.id, item));
    hasNext = response.hasNext || page + 1 < response.totalPages;
    if (hasNext && (response.content.length === 0 || previousSize === items.size)) {
      throw new Error("Milestone pagination returned an incomplete result");
    }
    page++;
  }
  return [...items.values()];
}
