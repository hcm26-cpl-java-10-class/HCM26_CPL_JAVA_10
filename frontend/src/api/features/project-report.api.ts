import axios from "@/api/axios";
import type { ReportDashboard, ReportExport, ReportFilters, ReportOptions } from "@/types/features/project-report";

const base = "/project-reports";
export const projectReportApi = {
  options: async (signal?: AbortSignal) => (await axios.get<ReportOptions>(base + "/options", { signal })).data,
  dashboard: async (params: ReportFilters, signal?: AbortSignal) => (await axios.get<ReportDashboard>(base, { params, signal })).data,
  exports: async (signal?: AbortSignal) => (await axios.get<ReportExport[]>(base + "/exports", { signal })).data,
  createExport: async (filters: ReportFilters, format: "EXCEL" | "CSV", key: string) =>
    (await axios.post<ReportExport>(base + "/exports", { filters, format }, { headers: { "Idempotency-Key": key } })).data,
  download: async (id: string) => (await axios.get<Blob>(`${base}/exports/${id}/download`, { responseType: "blob" })).data,
};
