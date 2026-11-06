import type { TaskDTO } from "./task";
export interface TaskAlertView { task: TaskDTO; canSend: boolean }
export interface OverdueTaskPage {
  content: TaskAlertView[]; totalElements: number; page: number; size: number; canSend: boolean;
}
export interface TaskAlertPayload {
  projectId: string; tasks: { taskId: string; version: number }[]; warningNote: string;
}
export interface TaskAlertResult {
  batchId: string; eventId: string; projectId: string; taskCount: number; recipientCount: number;
  status: "PENDING" | "DELIVERED" | "FAILED"; createdAt: string; correlationId: string;
}
export interface TaskAlertHistory {
  batchId: string; actorId: number; warningNote: string; status: TaskAlertResult["status"];
  createdAt: string; correlationId: string;
}
