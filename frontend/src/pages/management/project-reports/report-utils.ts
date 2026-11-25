import { isAxiosError } from "axios";
import type { ReportStatus } from "@/types/features/project-report";

export const statusLabels: Record<ReportStatus, string> = {
  DRAFT: "Draft", PLANNING: "Planning", ACTIVE: "In progress", COMPLETED: "Completed", CANCELLED: "Cancelled",
};
export const statusColors: Record<ReportStatus, string> = {
  DRAFT: "bg-slate-400", PLANNING: "bg-violet-400", ACTIVE: "bg-blue-500", COMPLETED: "bg-emerald-500", CANCELLED: "bg-rose-400",
};
export function reportStatuses(additional: ReportStatus[] = []): ReportStatus[] {
  // Pending team assignments do not create PLANNING projects in the current publication flow.
  // Show that status only when actual data or an existing filter explicitly includes it.
  return (Object.keys(statusLabels) as ReportStatus[]).filter(status => status === "ACTIVE" || status === "COMPLETED"
    || status !== "CANCELLED" && additional.includes(status));
}
export function reportDate(value: string | null, timeZone: string) {
  return value ? new Date(value).toLocaleString("en-GB", { timeZone }) : "—";
}
export async function reportError(error: unknown): Promise<string> {
  if (isAxiosError(error) && error.response?.data instanceof Blob) {
    try { const body = JSON.parse(await error.response.data.text()); if (typeof body.message === "string") return body.message; } catch { /* Non-JSON transport error. */ }
  }
  return reportErrorMessage(error);
}
export function reportErrorMessage(error: unknown): string {
  if (!isAxiosError(error)) return "Could not load the report. Try again.";
  if (error.response?.status === 401) return "Your session has ended. Sign in again.";
  if (typeof error.response?.data?.message === "string") return error.response.data.message;
  if (error.response?.status === 403) return "You do not have access to the data in this scope.";
  return "Could not load the report. Check your connection and try again.";
}
