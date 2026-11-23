import { isAxiosError } from "axios";
import { createLocaleFormatter } from "@/i18n/format";
import { toLanguage } from "@/i18n/languages";
import i18n from "@/i18n";
import type { ReportStatus } from "@/types/features/project-report";

const STATUS_LABEL_KEYS: Record<ReportStatus, string> = {
  DRAFT: "Draft", PLANNING: "Planning", ACTIVE: "In progress", COMPLETED: "Completed", CANCELLED: "Cancelled",
};

/**
 * Nhãn trạng thái, tra cứu lúc truy cập nên tự đổi theo ngôn ngữ hiện tại.
 */
export const statusLabels: Record<ReportStatus, string> = Object.defineProperties(
  {} as Record<ReportStatus, string>,
  Object.fromEntries(
    (Object.keys(STATUS_LABEL_KEYS) as ReportStatus[]).map((status) => [
      status,
      { get: () => i18n.t(STATUS_LABEL_KEYS[status]), enumerable: true },
    ]),
  ),
) as Record<ReportStatus, string>;

export const statusColors: Record<ReportStatus, string> = {
  DRAFT: "bg-slate-400", PLANNING: "bg-violet-400", ACTIVE: "bg-blue-500", COMPLETED: "bg-emerald-500", CANCELLED: "bg-rose-400",
};
export function reportStatuses(additional: ReportStatus[] = []): ReportStatus[] {
  return (Object.keys(STATUS_LABEL_KEYS) as ReportStatus[]).filter(status => status === "PLANNING" || status === "ACTIVE" || status === "COMPLETED"
    || status !== "CANCELLED" && additional.includes(status));
}
export function reportDate(value: string | null, timeZone: string) {
  if (!value) return "—";
  const locale = createLocaleFormatter(toLanguage(i18n.language)).locale;
  return new Date(value).toLocaleString(locale, { timeZone });
}
export async function reportError(error: unknown): Promise<string> {
  if (isAxiosError(error) && error.response?.data instanceof Blob) {
    try { const body = JSON.parse(await error.response.data.text()); if (typeof body.message === "string") return body.message; } catch { /* Non-JSON transport error. */ }
  }
  return reportErrorMessage(error);
}
export function reportErrorMessage(error: unknown): string {
  if (!isAxiosError(error)) return i18n.t("Unable to load the report. Please try again.");
  if (error.response?.status === 401) return i18n.t("Your session has expired. Please sign in again.");
  if (typeof error.response?.data?.message === "string") return error.response.data.message;
  if (error.response?.status === 403) return i18n.t("You do not have permission to view data in this scope.");
  return i18n.t("Unable to load the report. Please check your connection and try again.");
}
