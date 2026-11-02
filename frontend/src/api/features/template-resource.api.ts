import axiosInstance from "@/api/axios";
import type {
  TemplateResource,
  TemplateResourceCollection,
  TemplateResourceFile,
  TemplateResourcePayload,
} from "@/types/features/project-template-resource";

const path = "/project-template-versions";

/**
 * US-RES-001 — resource management of a template version.
 * Every route is version-scoped; the template id is derived on the server.
 */
export const templateResourceApi = {
  getByVersion: async (versionId: number, signal?: AbortSignal): Promise<TemplateResourceCollection> => {
    return (await axiosInstance.get<TemplateResourceCollection>(`${path}/${versionId}/resources`, { signal })).data;
  },

  create: async (versionId: number, payload: TemplateResourcePayload): Promise<TemplateResource> => {
    return (await axiosInstance.post<TemplateResource>(`${path}/${versionId}/resources`, payload)).data;
  },

  update: async (versionId: number, resourceId: number, payload: TemplateResourcePayload): Promise<TemplateResource> => {
    return (await axiosInstance.put<TemplateResource>(`${path}/${versionId}/resources/${resourceId}`, payload)).data;
  },

  remove: async (versionId: number, resourceId: number): Promise<void> => {
    await axiosInstance.delete(`${path}/${versionId}/resources/${resourceId}`);
  },

  uploadFile: async (versionId: number, resourceId: number, file: File): Promise<TemplateResourceFile> => {
    const form = new FormData();
    form.append("file", file);
    return (await axiosInstance.post<TemplateResourceFile>(
      `${path}/${versionId}/resources/${resourceId}/files`,
      form,
      { headers: { "Content-Type": undefined } },
    )).data;
  },

  deleteFile: async (versionId: number, fileId: number): Promise<void> => {
    await axiosInstance.delete(`${path}/${versionId}/resources/files/${fileId}`);
  },

  downloadFile: async (versionId: number, fileId: number): Promise<Blob> => {
    return (await axiosInstance.get<Blob>(`${path}/${versionId}/resources/files/${fileId}/download`, {
      responseType: "blob",
    })).data;
  },
};
