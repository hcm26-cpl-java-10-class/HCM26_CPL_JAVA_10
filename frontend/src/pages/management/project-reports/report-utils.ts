import { isAxiosError } from "axios";
import type { ReportStatus } from "@/types/features/project-report";

export const statusLabels: Record<ReportStatus, string> = {
  DRAFT: "Bản nháp", PLANNING: "Lên kế hoạch", ACTIVE: "Đang triển khai", COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy",
};
export const statusColors: Record<ReportStatus, string> = {
  DRAFT: "bg-slate-400", PLANNING: "bg-violet-400", ACTIVE: "bg-blue-500", COMPLETED: "bg-emerald-500", CANCELLED: "bg-rose-400",
};
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
