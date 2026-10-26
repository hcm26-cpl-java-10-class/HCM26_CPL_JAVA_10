import axiosInstance from "@/api/axios";
import type {
  CreateTaskPayload,
  ProjectBoard,
  ProjectTaskList,
  ProjectTaskAssignee,
  TaskListQuery,
  TaskStatusHistoryItem,
  TaskStatusUpdateResponse,
  TaskCard,
  ProjectBoardProjectOption,
  ProjectBoardSprintOption,
  UpdateTaskPayload,
  MoveTaskToSprintRequest,
  AssignTaskRequest,
  UpdateTaskOrderRequest,
} from "@/types/features/project-board";

export const projectBoardApi = {
  getBoardProjects: async (): Promise<ProjectBoardProjectOption[]> => {
    const response = await axiosInstance.get<ProjectBoardProjectOption[]>("/projects/board-options");
    return response.data;
  },

  getBoardSprints: async (projectId: number): Promise<ProjectBoardSprintOption[]> => {
    const response = await axiosInstance.get<ProjectBoardSprintOption[]>(
      `/projects/${projectId}/board-sprints`,
    );
    return response.data;
  },

  getBoard: async (projectId: number, sprintId: number): Promise<ProjectBoard> => {
    const response = await axiosInstance.get<ProjectBoard>(
      `/projects/${projectId}/sprints/${sprintId}/board`,
    );
    return response.data;
  },

  getTaskAssignees: async (projectId: number): Promise<ProjectTaskAssignee[]> => {
    const response = await axiosInstance.get<ProjectTaskAssignee[]>(
      `/projects/${projectId}/task-assignees`,
    );
    return response.data;
  },

  createTask: async (
    projectId: number,
    sprintId: number,
    payload: CreateTaskPayload,
    correlationId: string,
  ): Promise<TaskCard> => {
    const response = await axiosInstance.post<TaskCard>(
      `/projects/${projectId}/sprints/${sprintId}/tasks`,
      payload,
      { headers: { "X-Correlation-ID": correlationId } },
    );
    return response.data;
  },

  updateTask: async (
    projectId: number,
    taskId: number,
    payload: UpdateTaskPayload,
  ): Promise<TaskCard> => {
    const response = await axiosInstance.put<TaskCard>(
      `/projects/${projectId}/tasks/${taskId}`,
      payload,
    );
    return response.data;
  },

  deleteTask: async (projectId: number, taskId: number): Promise<void> => {
    await axiosInstance.delete(`/projects/${projectId}/tasks/${taskId}`);
  },

  getTasks: async (projectId: number, query: TaskListQuery): Promise<ProjectTaskList> => {
    const response = await axiosInstance.get<ProjectTaskList>(`/projects/${projectId}/tasks`, {
      params: query,
    });
    return response.data;
  },

  updateTaskStatus: async (
    projectId: number,
    taskId: number,
    status: TaskStatusUpdateResponse["status"],
    expectedVersion: number,
    correlationId: string,
  ): Promise<TaskStatusUpdateResponse> => {
    const response = await axiosInstance.patch<TaskStatusUpdateResponse>(
      `/projects/${projectId}/tasks/${taskId}/status`,
      { status, expectedVersion },
      { headers: { "X-Correlation-ID": correlationId } },
    );
    return response.data;
  },

  moveTaskToSprint: async (
    projectId: number,
    taskId: number,
    payload: MoveTaskToSprintRequest,
    correlationId: string,
  ): Promise<TaskStatusUpdateResponse> => {
    const response = await axiosInstance.patch<TaskStatusUpdateResponse>(
      `/projects/${projectId}/tasks/${taskId}/sprint`,
      payload,
      { headers: { "X-Correlation-ID": correlationId } },
    );
    return response.data;
  },

  assignTask: async (
    projectId: number,
    taskId: number,
    payload: AssignTaskRequest,
    correlationId: string,
  ): Promise<TaskStatusUpdateResponse> => {
    const response = await axiosInstance.patch<TaskStatusUpdateResponse>(
      `/projects/${projectId}/tasks/${taskId}/assignee`,
      payload,
      { headers: { "X-Correlation-ID": correlationId } },
    );
    return response.data;
  },

  updateTaskOrder: async (
    projectId: number,
    taskId: number,
    payload: UpdateTaskOrderRequest,
    correlationId: string,
  ): Promise<TaskStatusUpdateResponse> => {
    const response = await axiosInstance.patch<TaskStatusUpdateResponse>(
      `/projects/${projectId}/tasks/${taskId}/order`,
      payload,
      { headers: { "X-Correlation-ID": correlationId } },
    );
    return response.data;
  },

  getTaskStatusHistory: async (projectId: number, taskId: number): Promise<TaskStatusHistoryItem[]> => {
    const response = await axiosInstance.get<TaskStatusHistoryItem[]>(
      `/projects/${projectId}/tasks/${taskId}/status-history`,
    );
    return response.data;
  },
};
