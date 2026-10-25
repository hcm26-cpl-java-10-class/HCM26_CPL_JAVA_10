import axios from "@/api/axios";
import type { OverdueTaskPage, TaskAlertPayload, TaskAlertResult, TaskAlertHistory } from "@/types/features/task-alert";
export const taskAlertApi = {
  projects: async (signal?: AbortSignal) =>
    (await axios.get<{ id: string; name: string; code: string; canManage?: boolean }[]>("/task-alerts/projects", { signal })).data,
  overdue: async (projectId: string, page: number, signal?: AbortSignal) =>
    (await axios.get<OverdueTaskPage>("/task-alerts/overdue", { params: { projectId, page, size: 20 }, signal })).data,
  send: async (input: TaskAlertPayload, key: string) =>
    (await axios.post<TaskAlertResult>("/task-alerts", input, { headers: { "Idempotency-Key": key } })).data,
  history: async (taskId: string, signal?: AbortSignal) =>
    (await axios.get<TaskAlertHistory[]>("/task-alerts/tasks/" + taskId + "/history", { signal })).data,
  assignees: async (projectId: string, signal?: AbortSignal) =>
    (await axios.get<{ id: string; displayName: string }[]>("/task-alerts/assignees", { params: { projectId }, signal })).data,
};
