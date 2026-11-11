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
  relative: "Tương đối",
  iso: "ISO 8601",
};

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;

  if (abs < 60_000) return future ? "vài giây nữa" : "vừa xong";
  if (abs < 3_600_000) {
    const m = Math.round(abs / 60_000);
    return future ? `${m} phút nữa` : `${m} phút trước`;
  }
  if (abs < 86_400_000) {
    const h = Math.round(abs / 3_600_000);
    return future ? `${h} giờ nữa` : `${h} giờ trước`;
  }
  if (abs < 86_400_000 * 30) {
    const d = Math.round(abs / 86_400_000);
    return future ? `${d} ngày nữa` : `${d} ngày trước`;
  }
  if (abs < 86_400_000 * 365) {
    const mo = Math.round(abs / (86_400_000 * 30));
    return future ? `${mo} tháng nữa` : `${mo} tháng trước`;
  }
  const yr = Math.round(abs / (86_400_000 * 365));
  return future ? `${yr} năm nữa` : `${yr} năm trước`;
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
