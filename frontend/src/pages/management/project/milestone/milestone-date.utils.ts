/* Calendar-date helpers working on timezone-free "YYYY-MM-DD" strings. */

const DAY_MS = 86_400_000;
export const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function ymdToUtc(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00Z`);
}

function utcToYmd(utc: number): string {
  return new Date(utc).toISOString().slice(0, 10);
}

export function isYmd(value: string | undefined | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(ymdToUtc(value));
}

export function addDays(ymd: string, days: number): string {
  return utcToYmd(ymdToUtc(ymd) + days * DAY_MS);
}

export function diffDays(from: string, to: string): number {
  return Math.round((ymdToUtc(to) - ymdToUtc(from)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(ymd: string): number {
  return (new Date(ymdToUtc(ymd)).getUTCDay() + 6) % 7;
}

export function isWeekend(ymd: string): boolean {
  return weekdayIndex(ymd) >= 5;
}

export function addMonths(ymd: string, months: number): string {
  const date = new Date(ymdToUtc(ymd));
  return utcToYmd(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

export function endOfMonth(ymd: string): string {
  const date = new Date(ymdToUtc(ymd));
  return utcToYmd(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

export function firstOfMonth(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

/** Monday–Friday days between two dates, both inclusive. */
export function countWorkingDays(from: string, to: string): number {
  let count = 0;
  for (let day = from, guard = 0; day <= to && guard < 3700; day = addDays(day, 1), guard++) {
    if (!isWeekend(day)) count++;
  }
  return count;
}

export function deviceToday(): string {
  const now = new Date();
  return utcToYmd(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function formatLongDate(ymd: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(ymdToUtc(ymd)));
}

export function formatMonth(ymd: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(ymdToUtc(ymd)));
}
