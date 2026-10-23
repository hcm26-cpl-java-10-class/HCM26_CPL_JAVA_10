import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type { TaskDTO, TaskFilter, TaskPayload } from "@/types/features/task";

const path = "/tasks";
const { getPage, getById } = createBaseApiService<TaskDTO, TaskFilter>({ path });

export const taskApi = {
  getPage,
  getById,

  async getTags(projectId: string): Promise<string[]> {
    const response = await axiosInstance.get<string[]>(`${path}/tags`, { params: { projectId } });
    return response.data;
  },

  async create(data: TaskPayload, requestId: string): Promise<TaskDTO> {
    const response = await axiosInstance.post<TaskDTO>(path, data, {
      headers: { "Idempotency-Key": requestId },
    });
    return response.data;
  },

  async update(id: string, data: TaskPayload, requestId: string): Promise<TaskDTO> {
    const response = await axiosInstance.put<TaskDTO>(`${path}/${id}`, data, {
      headers: { "Idempotency-Key": requestId },
    });
    return response.data;
  },
};
