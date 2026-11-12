import axios from "@/api/axios";
import type { ReportActivityHistory, ReportActivityHistoryFilters, ReportActivityPage, ReportDashboard, ReportExport, ReportFilters, ReportOptions } from "@/types/features/project-report";

const base = "/project-reports";
export const projectReportApi = {
  options: async (signal?: AbortSignal) => (await axios.get<ReportOptions>(base + "/options", { signal })).data,
  dashboard: async (params: ReportFilters, signal?: AbortSignal) => (await axios.get<ReportDashboard>(base, { params, signal })).data,
  activities: async (filters: ReportFilters, offset: number, before?: string, signal?: AbortSignal) =>
    (await axios.get<ReportActivityPage>(base + "/activities", { params: { ...filters, offset, limit: 10, before }, signal })).data,
  activityHistory: async (filters: ReportFilters, history: ReportActivityHistoryFilters, signal?: AbortSignal) =>
    (await axios.get<ReportActivityHistory>(base + "/activities/history", { params: { ...filters, ...history }, signal })).data,
  exports: async (signal?: AbortSignal) => (await axios.get<ReportExport[]>(base + "/exports", { signal })).data,
  createExport: async (filters: ReportFilters, key: string) =>
    (await axios.post<ReportExport>(base + "/exports", { filters, format: "EXCEL" }, { headers: { "Idempotency-Key": key } })).data,
  download: async (id: string) => (await axios.get<Blob>(`${base}/exports/${id}/download`, { responseType: "blob" })).data,
};
