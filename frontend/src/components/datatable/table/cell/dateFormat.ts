// ─── Date format utilities for datatable ─────────────────────────────────────

export type DateFormatKey = "datetime" | "date" | "time" | "relative" | "iso";

export const DATE_FORMAT_CYCLE: DateFormatKey[] = [
  "datetime",
  "date",
  "time",
  "relative",
  "iso",
];

export const DATE_FORMAT_LABELS: Record<DateFormatKey, string> = {
  datetime: "D/M HH:mm",
  date: "DD/MM/YYYY",
  time: "HH:mm:ss",
  relative: "Relative",
  iso: "ISO 8601",
};

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;

  if (abs < 60_000) return future ? "in a few seconds" : "just now";
  if (abs < 3_600_000) {
    const m = Math.round(abs / 60_000);
    return relativeTime.format(future ? m : -m, "minute");
  }
  if (abs < 86_400_000) {
    const h = Math.round(abs / 3_600_000);
    return relativeTime.format(future ? h : -h, "hour");
  }
  if (abs < 86_400_000 * 30) {
    const d = Math.round(abs / 86_400_000);
    return relativeTime.format(future ? d : -d, "day");
  }
  if (abs < 86_400_000 * 365) {
    const mo = Math.round(abs / (86_400_000 * 30));
    return relativeTime.format(future ? mo : -mo, "month");
  }
  const yr = Math.round(abs / (86_400_000 * 365));
  return relativeTime.format(future ? yr : -yr, "year");
}

export function formatDateValue(
  value: any,
  format: DateFormatKey = "datetime"
): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    switch (format) {
      case "date":
        return d.toLocaleDateString("vi-VN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
      case "time":
        return d.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      case "relative":
        return formatRelative(d);
      case "iso":
        return d.toISOString();
      case "datetime":
      default:
        return d.toLocaleDateString("vi-VN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
    }
  } catch {
    return String(value);
  }
}
