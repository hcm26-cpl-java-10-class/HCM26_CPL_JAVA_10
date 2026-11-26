/** Múi giờ chuẩn của hệ thống (Việt Nam, UTC+7). */
export const APP_TIME_ZONE = "Asia/Ho_Chi_Minh";

/**
 * Ngày hôm nay theo múi giờ hệ thống, định dạng ISO `yyyy-MM-dd`.
 *
 * <p>`Intl.DateTimeFormat` trả về định dạng theo locale (`25/11/2026` với `vi-VN`,
 * `11/25/2026` với `en-US`), nên không dùng được cho `<input type="date">` và cũng không
 * parse lại được bằng `new Date(...)`. Vì vậy ngày được dựng thẳng từ các thành phần.
 */
export function todayIsoDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

/**
 * Ngày cách `days` ngày trước, định dạng ISO `yyyy-MM-dd`.
 */
export function daysAgoIsoDate(days: number, now: Date = new Date()): string {
  const [year, month, day] = todayIsoDate(now).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * Ngày cách `months` tháng trước (ngày 1 của tháng đó), định dạng ISO `yyyy-MM-dd`.
 */
export function monthsAgoIsoDate(months: number, now: Date = new Date()): string {
  const [year, month] = todayIsoDate(now).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 - months, 1));
  return date.toISOString().slice(0, 10);
}