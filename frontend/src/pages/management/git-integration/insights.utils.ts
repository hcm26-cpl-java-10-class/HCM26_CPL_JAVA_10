import type { GitActivityBucket, GitDailyActivity } from "@/types/features/git-integration";

/**
 * WS-GH-02: pure helpers of the Insights activity. Dates are local calendar days
 * (`YYYY-MM-DD`) in the server's time zone, as the insights API returns them.
 */

/** One bucket per day: the chart's columns when the server does not send `buckets` (a backend older than the long periods). */
export function dailyBuckets(daily: GitDailyActivity[] | undefined): GitActivityBucket[] {
  return (daily ?? []).map(day => ({ start: day.date, end: day.date, commits: day.commits,
    pullRequestsOpened: day.pullRequestsOpened, pullRequestsMerged: day.pullRequestsMerged }));
}

export interface ActivityBucket {
  /** First day of the bucket (the day itself, the Monday of the week or the 1st of the month, clipped to the period). */
  from: string;
  /** Last day of the bucket, included. */
  to: string;
  commits: number;
  pullRequestsOpened: number;
  pullRequestsMerged: number;
}

function parse(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const LONG = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** "16 Nov". */
export function shortDate(date: string) {
  return DAY.format(parse(date));
}

/** "Mon". */
export function weekday(date: string) {
  return WEEKDAY.format(parse(date));
}

/** "Mon, 16 Nov" for a day, "10–16 Nov" / "28 Oct – 3 Nov" for a span. */
export function spanLabel(from: string, to: string) {
  if (from === to) return LONG.format(parse(from));
  const a = parse(from);
  const b = parse(to);
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${DAY.format(b)}` : `${DAY.format(a)} – ${DAY.format(b)}`;
}

/** "18 h" under two days, then "3.2 d". */
export function formatDuration(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours * 10) / 10} h`;
  return `${Math.round((hours / 24) * 10) / 10} d`;
}

/** API bounds of a day span (the commits API includes both ends). */
export function apiBounds(from?: string, to?: string) {
  return { from: from ? `${from}T00:00:00` : undefined, to: to ? `${to}T23:59:59.999999` : undefined };
}

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" });
const MONTH_LONG = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const DAY_YEAR = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** "Nov 25" (axis label of a month). */
export function monthLabel(date: string) {
  return MONTH.format(parse(date));
}

/** "November 2025". */
export function monthLongLabel(date: string) {
  return MONTH_LONG.format(parse(date));
}

/** Like {@link spanLabel}, with years when the span is not within the current year ("16 Nov 2023 – 23 Nov 2026"). */
export function periodLabel(from: string, to: string) {
  const year = new Date().getFullYear();
  const a = parse(from);
  const b = parse(to);
  if (a.getFullYear() === year && b.getFullYear() === year) return spanLabel(from, to);
  return from === to ? DAY_YEAR.format(a) : `${DAY_YEAR.format(a)} – ${DAY_YEAR.format(b)}`;
}
