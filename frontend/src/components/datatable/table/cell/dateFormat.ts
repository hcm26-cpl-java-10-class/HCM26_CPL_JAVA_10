import { createLocaleFormatter, type LocaleFormatter } from "@/i18n/format";
import { toLanguage } from "@/i18n/languages";
import i18n from "@/i18n";

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

const formatterFor = (): LocaleFormatter => createLocaleFormatter(toLanguage(i18n.language));

/**
 * Định dạng giá trị ngày theo locale của ngôn ngữ đang chọn.
 *
 * Hàm thuần: gọi ở render để giá trị luôn khớp với ngôn ngữ hiện tại.
 */
export function formatDateValue(
  value: any,
  format: DateFormatKey = "datetime"
): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const formatter = formatterFor();
    switch (format) {
      case "date":
        return formatter.formatDate(d);
      case "time":
        return formatter.formatTime(d);
      case "relative":
        return formatter.formatRelative(d);
      case "iso":
        return d.toISOString();
      case "datetime":
      default:
        return formatter.formatDateTime(d);
    }
  } catch {
    return String(value);
  }
}
