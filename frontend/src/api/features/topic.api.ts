import axiosInstance from "../axios";
import type { TopicItem, TopicImportPreview } from "@/types/features/content";
import type { PageResponse } from "@/types/common/pageable";

const path = "/topics";

export const topicApi = {
  getPage: async (params: {
    page?: number;
    size?: number;
    search?: string;
    technicalGroup?: string;
    status?: string;
    sort?: string;
  }): Promise<PageResponse<TopicItem>> => {
    const res = await axiosInstance.get<PageResponse<TopicItem>>(path, { params });
    return res.data;
  },

  getAll: async (): Promise<TopicItem[]> => {
    const res = await axiosInstance.get<PageResponse<TopicItem>>(path, {
      params: { size: 1000 },
    });
    return res.data.content;
  },

  getActive: async (): Promise<TopicItem[]> => {
    const res = await axiosInstance.get<TopicItem[]>(`${path}/active`);
    return res.data;
  },

  getById: async (id: number | string): Promise<TopicItem> => {
    const res = await axiosInstance.get<TopicItem>(`${path}/${id}`);
    return res.data;
  },

  create: async (data: Partial<TopicItem>): Promise<TopicItem> => {
    const res = await axiosInstance.post<TopicItem>(path, data);
    return res.data;
  },

  update: async (id: number | string, data: Partial<TopicItem>): Promise<TopicItem> => {
    const res = await axiosInstance.put<TopicItem>(`${path}/${id}`, data);
    return res.data;
  },

  delete: async (id: number | string): Promise<void> => {
    await axiosInstance.delete(`${path}/${id}`);
  },

  changeStatus: async (id: number | string, active: boolean): Promise<TopicItem> => {
    const res = await axiosInstance.patch<TopicItem>(`${path}/${id}/status`, null, {
      params: { active },
    });
    return res.data;
  },

  isReferenced: async (id: number | string): Promise<boolean> => {
    const res = await axiosInstance.get<boolean>(`${path}/${id}/is-referenced`);
    return res.data;
  },

  exportFile: async (format: "EXCEL" | "CSV" | "PDF" = "EXCEL"): Promise<Blob> => {
    const res = await axiosInstance.get(`${path}/export`, {
      params: { format },
      responseType: "blob",
    });
    return res.data;
  },

  previewImport: async (file: File): Promise<TopicImportPreview> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await axiosInstance.post<TopicImportPreview>(`${path}/import/preview`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  importFile: async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await axiosInstance.post(`${path}/import`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  commitImport: async (items: Partial<TopicItem>[]): Promise<any> => {
    const res = await axiosInstance.post(`${path}/import/commit`, items);
    return res.data;
  },

  downloadImportTemplate: async (): Promise<Blob> => {
    const res = await axiosInstance.get(`${path}/import/template`, {
      responseType: "blob",
    });
    return res.data;
  },
};
