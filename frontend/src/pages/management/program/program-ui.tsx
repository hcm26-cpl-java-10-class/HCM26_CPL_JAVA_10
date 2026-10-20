import axios from "axios";
import type { ProgramStatus } from "@/api/features/program.api";
import { Badge } from "@/components/ui/badge";

export const statusLabels: Record<ProgramStatus, string> = {
  DRAFT: "Bản nháp",
  ACTIVE: "Đang áp dụng",
  INACTIVE: "Ngừng áp dụng",
};

const statusStyles: Record<ProgramStatus, string> = {
  DRAFT: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  INACTIVE: "border-border bg-muted text-muted-foreground",
};

export function ProgramStatusBadge({ status }: { status: ProgramStatus }) {
  return <Badge variant="outline" className={`gap-1.5 whitespace-nowrap font-medium ${statusStyles[status]}`}>
    <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{statusLabels[status]}
  </Badge>;
}

export function errorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message: unknown = error.response?.data?.message;
    if (typeof message === "string") return message;
    if (!error.response) return "Không thể kết nối máy chủ. Vui lòng thử lại.";
  }
  return fallback;
}

export function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/đ/g, "d").trim();
}

export const primaryButtonClass = "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600";
