/** Shared palette and helpers for the Course Analytics charts. */
import { createLocaleFormatter } from "@/i18n/format";
import { toLanguage } from "@/i18n/languages";
import i18n from "@/i18n";

export const CHART_COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
] as const;

export const AXIS_COLOR = "#94a3b8";
export const GRID_COLOR = "#e2e8f0";

/**
 * Bộ định dạng theo ngôn ngữ đang chọn.
 *
 * Đọc `i18n.language` tại thời điểm gọi nên component tự hiển thị lại khi đổi ngôn ngữ,
 * không cần truyền locale thủ công vào từng chart.
 */
const formatter = () => createLocaleFormatter(toLanguage(i18n.language));

export const formatNumber = (value?: number | null): string =>
  typeof value === "number" && Number.isFinite(value)
    ? formatter().formatNumber(value)
    : "—";

export const formatPercent = (value?: number | null, digits = 1): string =>
  typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(digits)}%`
    : "—";

export const formatDateTime = (value?: string | null): string => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return formatter().formatDateTime(parsed);
};

export const formatDate = (value?: string | null): string => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return formatter().formatDate(parsed);
};

/** Shortens lesson labels so the X axis does not overlap. */
export const truncateLabel = (value: string, max = 18): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

/**
 * Formatter for the recharts `Tooltip`. In recharts 3 the `value` can be
 * `undefined`, so it is coerced to a number before formatting.
 */
export const tooltipNumber = (
  value: unknown,
  label: string,
): [string, string] => [formatNumber(Number(value)), i18n.t(label)];

export const tooltipPercent = (
  value: unknown,
  label: string,
): [string, string] => [formatPercent(Number(value)), i18n.t(label)];
