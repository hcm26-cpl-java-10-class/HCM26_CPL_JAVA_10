import { isAxiosError } from "axios";
import { Badge } from "@/components/ui/badge";
import type { ReportStatus } from "@/types/features/project-report";

export const statusLabels: Record<ReportStatus, string> = {
  NOT_STARTED: "Chưa bắt đầu", IN_PROGRESS: "Đang thực hiện", SUBMITTED: "Đã nộp · Chờ chấm", DONE: "Hoàn thành", CANCELLED: "Đã hủy",
};
export const statusColors: Record<ReportStatus, string> = {
  NOT_STARTED: "bg-slate-400", IN_PROGRESS: "bg-blue-500", SUBMITTED: "bg-violet-500", DONE: "bg-emerald-500", CANCELLED: "bg-rose-400",
};
const statusStyles: Record<ReportStatus, string> = {
  NOT_STARTED: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  IN_PROGRESS: "border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  SUBMITTED: "border-violet-100 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
  DONE: "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  CANCELLED: "border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
};
export function StatusBadge({ status }: { status: ReportStatus }) {
  return <Badge variant="outline" className={`gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 font-medium ${statusStyles[status]}`}><span className={`size-1.5 rounded-full ${statusColors[status]}`} />{statusLabels[status]}</Badge>;
}
export function ProgressValue({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">Chưa đủ cấu hình</span>;
  return <div className="min-w-28 space-y-2"><span className="text-sm font-semibold tabular-nums">{value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%</span>
    <div role="progressbar" aria-label="Tiến độ" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${value >= 100 ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div></div>;
}
export function reportDate(value: string | null, timeZone: string) {
  return value ? new Date(value).toLocaleString("vi-VN", { timeZone }) : "—";
}
export async function reportError(error: unknown): Promise<string> {
  if (isAxiosError(error) && error.response?.data instanceof Blob) {
    try { const body = JSON.parse(await error.response.data.text()); if (typeof body.message === "string") return body.message; } catch { /* Non-JSON transport error. */ }
  }
  return reportErrorMessage(error);
}
export function reportErrorMessage(error: unknown): string {
  if (!isAxiosError(error)) return "Không thể tải báo cáo. Hãy thử lại.";
  if (error.response?.status === 401) return "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
  if (typeof error.response?.data?.message === "string") return error.response.data.message;
  if (error.response?.status === 403) return "Bạn không có quyền xem dữ liệu trong phạm vi này.";
  return "Không thể tải báo cáo. Hãy kiểm tra kết nối và thử lại.";
}
