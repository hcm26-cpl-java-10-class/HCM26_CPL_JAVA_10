import { isAxiosError } from "axios";
import axiosInstance from "@/api/axios";

export interface TemplateResource {
  id: number;
  kind: "FILE" | "LINK";
  title: string;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  url: string | null;
}

export interface TemplateResourceListing {
  templateId: number;
  versionId: number | null;
  lockVersion: number;
  editable: boolean;
  maxFileBytes: number;
  resources: TemplateResource[];
}

const path = (templateId: number) => `/project-templates/${templateId}/resources`;

export const templateResourceApi = {
  list: async (templateId: number, versionId?: number, signal?: AbortSignal) =>
    (await axiosInstance.get<TemplateResourceListing>(path(templateId), { params: { versionId }, signal })).data,
  upload: async (templateId: number, file: File, lockVersion: number, versionId?: number) =>
    (await axiosInstance.post<TemplateResourceListing>(`${path(templateId)}/files`, file, {
      params: { fileName: file.name, lockVersion, versionId }, headers: { "Content-Type": "application/octet-stream" },
    })).data,
  addLink: async (templateId: number, title: string, url: string, lockVersion: number, versionId?: number) =>
    (await axiosInstance.post<TemplateResourceListing>(`${path(templateId)}/links`, { title, url, lockVersion }, { params: { versionId } })).data,
  remove: async (templateId: number, resourceId: number, lockVersion: number, versionId?: number) =>
    (await axiosInstance.delete<TemplateResourceListing>(`${path(templateId)}/${resourceId}`, { params: { lockVersion, versionId } })).data,
  download: async (templateId: number, resourceId: number, versionId?: number) => {
    try {
      const { data } = await axiosInstance.post<{ url: string }>(`${path(templateId)}/${resourceId}/download-link`, undefined, { params: { versionId } });
      return (await axiosInstance.get<Blob>(data.url, { responseType: "blob" })).data;
    } catch (error) {
      if (isAxiosError(error) && error.response?.data instanceof Blob) {
        const text = await error.response.data.text();
        try { error.response.data = JSON.parse(text); }
        catch { error.response.data = { message: "The resource could not be downloaded. Please try again." }; }
      }
      throw error;
    }
  },
};
