import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type {
  TaskDTO,
  TaskFilter,
  TaskPayload,
  TaskWorkflowDTO,
  TaskActivityDTO,
  TaskStatusPayload,
  TaskDependencyPayload,
} from "@/types/features/task";

const path = "/tasks";
const { getPage, getById } = createBaseApiService<TaskDTO, TaskFilter>({ path });

export const taskApi = {
  getPage,
  getById,

  async getWorkflow(id: string): Promise<TaskWorkflowDTO> {
    const response = await axiosInstance.get<TaskWorkflowDTO>(`${path}/${id}/workflow`);
    return response.data;
  },

  async getActivity(id: string): Promise<TaskActivityDTO[]> {
    const response = await axiosInstance.get<TaskActivityDTO[]>(`${path}/${id}/activity`);
    return response.data;
  },

  async changeStatus(id: string, data: TaskStatusPayload, requestId: string): Promise<TaskDTO> {
    const response = await axiosInstance.patch<TaskDTO>(`${path}/${id}/status`, data, {
      headers: { "Idempotency-Key": requestId },
    });
    return response.data;
  },

  async addDependency(
    id: string,
    data: TaskDependencyPayload,
    requestId: string,
  ): Promise<TaskDTO> {
    const response = await axiosInstance.post<TaskDTO>(`${path}/${id}/dependencies`, data, {
      headers: { "Idempotency-Key": requestId },
    });
    return response.data;
  },

  async removeDependency(
    id: string,
    predecessorId: string,
    version: number,
    requestId: string,
  ): Promise<TaskDTO> {
    const response = await axiosInstance.delete<TaskDTO>(
      `${path}/${id}/dependencies/${predecessorId}`,
      {
        params: { version },
        headers: { "Idempotency-Key": requestId },
      },
    );
    return response.data;
  },

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
