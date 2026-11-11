import axios from "axios";
import { UnsupportedApiResponseError } from "@/api/features/project-assignment.api";
import type { AssignmentBriefMilestone, AssignmentCatalogFilter, AssignmentCatalogSort, AssignmentTemplateLevel } from "@/types/features/project-assignment";

export const CATALOG_PAGE_SIZE = 12;

export const catalogLevelOptions: Array<{ value: AssignmentTemplateLevel; label: string }> = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
];

export const catalogSortOptions: Array<{ value: AssignmentCatalogSort; label: string }> = [
  { value: "NAME", label: "Tên A–Z" },
  { value: "CODE", label: "Mã đề bài" },
  { value: "RECENT", label: "Mới công bố" },
];

export type CatalogUrlFilter = Omit<AssignmentCatalogFilter, "size" | "teamId">;

/** Catalogue filters live in the URL (`q`, `category`, `level`, `fit`, `sort`, 1-based `page`) so they survive navigation. */
export function readCatalogFilter(params: URLSearchParams): CatalogUrlFilter {
  const sort = params.get("sort");
  const page = Number(params.get("page"));
  return {
    search: params.get("q") ?? "",
    category: params.get("category") ?? "",
    level: params.get("level") ?? "",
    fit: params.get("fit") === "1",
    sort: catalogSortOptions.some(option => option.value === sort) ? sort as AssignmentCatalogSort : "NAME",
    page: Number.isSafeInteger(page) && page > 1 ? page - 1 : 0,
  };
}

export const catalogUrlKeys = ["q", "category", "level", "fit", "sort", "page"] as const;

export function levelLabel(level: string | null | undefined) {
  return catalogLevelOptions.find(option => option.value === level)?.label ?? level ?? null;
}

export function assignmentFailure(error: unknown, fallback = "Không thể gán đề bài. Vui lòng thử lại.") {
  if (error instanceof UnsupportedApiResponseError) return error.message;
  if (axios.isAxiosError<{ message?: string }>(error)) {
    if (error.response?.status === 403) return "Bạn không có quyền gán đề bài cho phiên này.";
    return error.response?.data?.message ?? fallback;
  }
  return fallback;
}

export function isVersionChanged(error: unknown) {
  return axios.isAxiosError<{ code?: string }>(error)
    && error.response?.status === 409 && error.response.data?.code === "PROJECT_ASSIGNMENT_VERSION_CHANGED";
}

export function milestoneDue(milestone: Pick<AssignmentBriefMilestone, "dueAfter" | "dueUnit">) {
  if (milestone.dueAfter == null) return null;
  return `Hạn: ${milestone.dueAfter} ${milestone.dueUnit === "WEEKS" ? "tuần" : "ngày"} sau khi công bố`;
}

export function formatPublishedAt(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("vi-VN");
}
