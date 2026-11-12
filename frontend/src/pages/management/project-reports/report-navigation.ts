import type { ReportFilters, ReportStatus, ReportRisk } from "@/types/features/project-report";

export const reportDefaults: ReportFilters = { risk: "ALL", includeCancelled: false, page: 0, size: 10 };
const ids = ["programId", "cohortId", "classId", "mentorId", "templateId", "sourceVersionId", "teamId", "projectId", "masterId", "workSprintId"] as const;
const statuses = new Set(["DRAFT", "PLANNING", "ACTIVE", "COMPLETED", "CANCELLED"]);
const risks = new Set(["ALL", "OVERDUE", "INACTIVE_MEMBERS", "NEEDS_ATTENTION", "LATE_SUBMISSION"]);
const keys = [...ids, "status", "masterStatus", "risk", "includeCancelled", "createdFrom", "createdTo", "q", "page", "size"];

export function readReportFilters(params: URLSearchParams): ReportFilters {
  const result: ReportFilters = { ...reportDefaults };
  for (const key of ids) {
    const value = Number(params.get(key));
    if (Number.isSafeInteger(value) && value > 0) result[key] = value;
  }
  for (const key of ["status", "masterStatus"] as const) {
    const value = params.get(key);
    if (value && statuses.has(value)) result[key] = value as ReportStatus;
  }
  const risk = params.get("risk");
  if (risk && risks.has(risk)) result.risk = risk as ReportRisk;
  result.includeCancelled = params.get("includeCancelled") === "true";
  for (const key of ["createdFrom", "createdTo"] as const) {
    const value = params.get(key);
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) result[key] = value;
  }
  const q = params.get("q")?.slice(0, 120);
  if (q) result.q = q;
  const page = Number(params.get("page")), size = Number(params.get("size"));
  if (Number.isSafeInteger(page) && page >= 0) result.page = page;
  if (Number.isSafeInteger(size) && size >= 1 && size <= 50) result.size = size;
  return result;
}

export function writeReportFilters(current: URLSearchParams, filters: ReportFilters) {
  const next = new URLSearchParams(current);
  for (const key of keys) next.delete(key);
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "" && value !== false
      && !(key === "risk" && value === "ALL") && !(key === "page" && value === 0) && !(key === "size" && value === 10)) next.set(key, String(value));
  }
  return next;
}
