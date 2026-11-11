import axiosInstance from "../axios";
import type { TrainingProgramItem, TrainingProgramRequest, ProgramSubjectRequest, ProgramStatus } from "@/types/features/content";
import type { PageResponse } from "@/types/common/pageable";

const path = "/programs";

export const programApi = {
  getPage: async (params: {
    page?: number;
    size?: number;
    search?: string;
    status?: ProgramStatus;
    region?: string;
    sort?: string;
  }): Promise<PageResponse<TrainingProgramItem>> => {
    const res = await axiosInstance.get<PageResponse<TrainingProgramItem>>(path, { params });
    return res.data;
  },

  getAll: async (): Promise<TrainingProgramItem[]> => {
    const res = await axiosInstance.get<PageResponse<TrainingProgramItem>>(path, {
      params: { size: 1000 },
    });
    return res.data.content;
  },

  getById: async (id: number | string): Promise<TrainingProgramItem> => {
    const res = await axiosInstance.get<TrainingProgramItem>(`${path}/${id}`);
    return res.data;
  },

  getRegions: async (): Promise<string[]> => {
    const res = await axiosInstance.get<string[]>(`${path}/regions`);
    return res.data;
  },

  create: async (data: TrainingProgramRequest): Promise<TrainingProgramItem> => {
    const res = await axiosInstance.post<TrainingProgramItem>(path, data);
    return res.data;
  },

  update: async (id: number | string, data: TrainingProgramRequest): Promise<TrainingProgramItem> => {
    const res = await axiosInstance.put<TrainingProgramItem>(`${path}/${id}`, data);
    return res.data;
  },

  updateSubjects: async (id: number | string, subjects: ProgramSubjectRequest[]): Promise<TrainingProgramItem> => {
    const res = await axiosInstance.put<TrainingProgramItem>(`${path}/${id}/subjects`, subjects);
    return res.data;
  },

  cloneVersion: async (id: number | string, newVersion: string): Promise<TrainingProgramItem> => {
    const res = await axiosInstance.post<TrainingProgramItem>(`${path}/${id}/clone`, null, {
      params: { newVersion },
    });
    return res.data;
  },

  activate: async (id: number | string): Promise<TrainingProgramItem> => {
    const res = await axiosInstance.post<TrainingProgramItem>(`${path}/${id}/activate`);
    return res.data;
  },

  changeStatus: async (id: number | string, status: ProgramStatus): Promise<TrainingProgramItem> => {
    const res = await axiosInstance.patch<TrainingProgramItem>(`${path}/${id}/status`, null, {
      params: { status },
    });
    return res.data;
  },

  delete: async (id: number | string): Promise<void> => {
    await axiosInstance.delete(`${path}/${id}`);
  },

  exportFile: async (params?: {
    search?: string;
    status?: ProgramStatus;
    region?: string;
    format?: "xlsx" | "csv" | "txt";
    scope?: "all" | "filtered";
  }): Promise<Blob> => {
    const res = await axiosInstance.get(`${path}/export`, {
      params: {
        ...params,
        format: params?.format || "xlsx",
        scope: params?.scope || "filtered",
      },
      responseType: "blob",
    });
    return res.data;
  },

  downloadImportTemplate: async (): Promise<Blob> => {
    const res = await axiosInstance.get(`${path}/import/template`, {
      responseType: "blob",
    });
    return res.data;
  },

  previewImport: async (file: File): Promise<any> => {
    const body = new FormData();
    body.append("file", file);
    const res = await axiosInstance.post(`${path}/import/preview`, body, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  importFile: async (file: File): Promise<{ importedPrograms: number; message: string }> => {
    const body = new FormData();
    body.append("file", file);
    const res = await axiosInstance.post<{ importedPrograms: number; message: string }>(
      `${path}/import`,
      body,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return res.data;
  },

  commitImport: async (items: any[]): Promise<{ importedPrograms: number; message: string }> => {
    const res = await axiosInstance.post<{ importedPrograms: number; message: string }>(
      `${path}/import/commit`,
      items
    );
    return res.data;
  },
};
