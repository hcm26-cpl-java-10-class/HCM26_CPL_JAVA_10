import type { GitDailyActivity } from "@/types/features/git-integration";

/**
 * WS-GH-02: pure helpers of the Insights activity. Dates are local calendar days
 * (`YYYY-MM-DD`) in the server's time zone, as the insights API returns them.
 */

export interface ActivityBucket {
  /** First day of the bucket (the day itself, or the Monday of the week). */
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

function format(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Monday of the week of `date`. */
export function weekStart(date: string) {
  const day = parse(date);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return format(day);
}

/** One bucket per day. */
export function byDay(daily: GitDailyActivity[]): ActivityBucket[] {
  return daily.map(day => ({ from: day.date, to: day.date, commits: day.commits,
    pullRequestsOpened: day.pullRequestsOpened, pullRequestsMerged: day.pullRequestsMerged }));
}

/** Monday-to-Sunday buckets, clipped to the period (the first and last week can be partial). */
export function byWeek(daily: GitDailyActivity[]): ActivityBucket[] {
  const buckets: ActivityBucket[] = [];
  for (const day of daily) {
    const start = weekStart(day.date);
    const last = buckets[buckets.length - 1];
    if (last && weekStart(last.from) === start) {
      last.to = day.date;
      last.commits += day.commits;
      last.pullRequestsOpened += day.pullRequestsOpened;
      last.pullRequestsMerged += day.pullRequestsMerged;
    } else {
      buckets.push({ from: day.date, to: day.date, commits: day.commits,
        pullRequestsOpened: day.pullRequestsOpened, pullRequestsMerged: day.pullRequestsMerged });
    }
  }
  return buckets;
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
