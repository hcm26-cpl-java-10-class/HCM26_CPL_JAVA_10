import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "../axios";
import type { SubjectDTO, SubjectFilter, Pagination, FileFormat, ImportResult } from "@/types";
import type { SubjectUsage, SubjectImportPreview, SubjectImportInputRow } from "@/types/features/subject";
import { subjectFilters, subjectExportParams } from "@/utils/subject-query.utils";
import { normalizeSubjectIdentity } from "@/utils/subject-identity.utils";

const path = "/subjects";
export const technicalGroupQueryKey = ["subject-technical-groups"] as const;

const base = createBaseApiService<SubjectDTO, SubjectFilter>({
  path: path,
});

export const subjectApi = Object.assign({}, base, {
  getPage: (pagination: Pagination, search?: string, filter?: SubjectFilter) =>
    base.getPage(pagination, search, subjectFilters(filter as unknown as Record<string, unknown>) as unknown as SubjectFilter),

  cloneVersion: async (id: number | string, version: string): Promise<SubjectDTO> =>
    (await axiosInstance.post<SubjectDTO>(`${path}/${id}/clone`, { version })).data,

  getUsage: async (id: number | string): Promise<SubjectUsage> =>
    (await axiosInstance.get<SubjectUsage>(`${path}/${id}/usage`)).data,

  previewImport: async (file: File): Promise<SubjectImportPreview> => {
    const body = new FormData();
    body.append("file", file);
    return (await axiosInstance.post<SubjectImportPreview>(`${path}/import/preview`, body, {
      headers: { "Content-Type": "multipart/form-data" },
    })).data;
  },

  previewImportRows: async (rows: SubjectImportInputRow[]): Promise<SubjectImportPreview> =>
    (await axiosInstance.post<SubjectImportPreview>(`${path}/import/preview-rows`, { rows })).data,

  importRows: async (rows: SubjectImportInputRow[]): Promise<ImportResult> =>
    (await axiosInstance.post<ImportResult>(`${path}/import/rows`, { rows })).data,

  downloadTemplate: () => axiosInstance.get(`${path}/import-template`, { responseType: "blob" }),

  exportFiltered: (format: FileFormat, search: string, filters: Record<string, unknown>, sort: string[]) =>
    axiosInstance.get(`${path}/export/filtered`, { params: subjectExportParams(format, search, filters, sort), responseType: "blob" }),

  getTechnicalGroups: async (): Promise<string[]> =>
    (await axiosInstance.get<string[]>(`${path}/technical-groups`)).data,

  createTechnicalGroup: async (name: string): Promise<{ name: string }> =>
    (await axiosInstance.post<{ name: string }>(`${path}/technical-groups`, { name })).data,

  create: (data: SubjectDTO) => base.create(normalizeSubjectIdentity(data)),

  update: (id: string, data: SubjectDTO) => base.update(id, normalizeSubjectIdentity(data)),

  getActiveSubjects: async (): Promise<SubjectDTO[]> => {
    const response = await axiosInstance.get<SubjectDTO[]>(`${path}/active`);
    return response.data;
  },

  changeStatus: async (id: number | string, active: boolean): Promise<SubjectDTO> => {
    const response = await axiosInstance.patch<SubjectDTO>(`${path}/${id}/status`, null, {
      params: { active },
    });
    return response.data;
  },

  isSubjectReferenced: async (id: number | string): Promise<boolean> => {
    const response = await axiosInstance.get<boolean>(`${path}/${id}/is-referenced`);
    return response.data;
  },
});
