import { isAxiosError } from "axios";
import axiosInstance from "@/api/axios";
import type { ProjectResourceDownloadLink, WorkspaceProjectResources } from "@/types/features/project-resource";

export const projectResourceApi = {
  list: async (workspaceId: number, signal?: AbortSignal) =>
    (await axiosInstance.get<WorkspaceProjectResources>(`/workspaces/${workspaceId}/resources`, { signal })).data,

  download: async (workspaceId: number, resourceId: number, signal?: AbortSignal) => {
    try {
      const { data: link } = await axiosInstance.post<ProjectResourceDownloadLink>(
        `/workspaces/${workspaceId}/resources/${resourceId}/download-link`, undefined, { signal });
      return (await axiosInstance.get<Blob>(link.url, { responseType: "blob", signal })).data;
    } catch (error) {
      if (isAxiosError(error) && error.response?.data instanceof Blob) {
        const text = await error.response.data.text();
        try { error.response.data = JSON.parse(text); } catch { error.response.data = { message: "The resource could not be downloaded. Please try again." }; }
      }
      throw error;
    }
  },
};
