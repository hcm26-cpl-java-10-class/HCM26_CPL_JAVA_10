import { isISODate } from "./assignment-form.ts";

/** Session timestamps represent schedule-local time. Do not shift them to the browser timezone. */
export function formatScheduleDateTime(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(value);
  if (!match || !isISODate(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4] ?? 0) > 59) return "—";
  return `${match[1].split("-").reverse().join("/")} ${match[2]}:${match[3]}`;
}

export function safeMeetingUrl(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}
