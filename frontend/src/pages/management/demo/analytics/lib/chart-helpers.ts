/** Bảng màu + helper dùng chung cho các biểu đồ Course Analytics. */

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

export const formatNumber = (value?: number | null): string =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("vi-VN")
    : "—";

export const formatPercent = (value?: number | null, digits = 1): string =>
  typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(digits)}%`
    : "—";

export const formatDateTime = (value?: string | null): string => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDate = (value?: string | null): string => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

/** Rút gọn nhãn bài để trục X không bị chồng chữ. */
export const truncateLabel = (value: string, max = 18): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

/**
 * Formatter cho recharts `Tooltip`. recharts 3 truyền `value` có thể là
 * `undefined`, nên ép về number trước khi format.
 */
export const tooltipNumber = (
  value: unknown,
  label: string,
): [string, string] => [formatNumber(Number(value)), label];

export const tooltipPercent = (
  value: unknown,
  label: string,
): [string, string] => [formatPercent(Number(value)), label];

