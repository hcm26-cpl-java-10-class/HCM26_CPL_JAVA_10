import type { TaskDTO, TaskPayload, TaskPriority } from "@/types/features/task";
import axios from "axios";

export interface TaskFormValues {
  title: string;
  description: string;
  estimatedHours: string;
  deadline: string;
  priority: TaskPriority;
}

export type TaskFieldErrors = Record<string, string[] | undefined>;

export const maxTaskDescriptionWords = 1000;

export function taskDescriptionWordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/u).length : 0;
}

export const taskStatusOptions = [
  { value: "TODO", label: "To Do" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "REVIEW", label: "Review" },
  { value: "DONE", label: "Done" },
] as const;

export const subtaskStatusOptions = taskStatusOptions.filter(option =>
  option.value === "TODO" || option.value === "IN_PROGRESS" || option.value === "DONE");

export const taskPriorityOptions = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
] as const;

export const taskConflictMessage =
  "This task was changed by another member. Please reload the page.";

export function isProjectId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function toTaskFormValues(task?: TaskDTO): TaskFormValues {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    estimatedHours: task?.estimatedHours == null ? "" : String(task.estimatedHours),
    deadline: task?.deadline ? new Date(new Date(task.deadline).getTime()
      - new Date(task.deadline).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "",
    priority: task?.priority ?? "MEDIUM",
  };
}

export function validateTaskForm(values: TaskFormValues, estimateRequired = false): TaskFieldErrors {
  const errors: TaskFieldErrors = {};
  const title = values.title.trim();
  if (!title || title.length > 250) {
    errors.title = ["Task title must contain 1 to 250 characters"];
  }
  if (taskDescriptionWordCount(values.description) > maxTaskDescriptionWords) {
    errors.description = ["Description must not exceed 1000 words"];
  }
  const hours = values.estimatedHours.trim();
  if (values.deadline && Number.isNaN(new Date(values.deadline).getTime())) {
    errors.deadline = ["Please enter a valid deadline"];
  }
  if (
    (estimateRequired && !hours) ||
    (hours &&
      (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(hours) ||
        !Number.isFinite(Number(hours)) ||
        Number(hours) <= 0))
  ) {
    errors.estimatedHours = ["Estimate must be a valid number greater than 0"];
  }
  if (!taskPriorityOptions.some((option) => option.value === values.priority)) {
    errors.priority = ["Please select a valid priority"];
  }
  return errors;
}

export function toTaskPayload(
  values: TaskFormValues,
  projectId: string,
  task?: TaskDTO,
): TaskPayload {
  return {
    projectId,
    sprintId: task?.sprintId ?? null,
    milestoneId: task?.milestoneId ?? null,
    assigneeProjectMemberId: task?.assigneeProjectMemberId ?? null,
    title: values.title.trim(),
    description: values.description.trim() || null,
    estimatedHours: values.estimatedHours.trim() ? Number(values.estimatedHours) : null,
    deadline: values.deadline ? new Date(values.deadline).toISOString() : null,
    priority: values.priority,
    tags: task?.tags ?? [],
    ...(task ? { version: task.version } : {}),
  };
}

export interface TaskRequestError {
  status?: number;
  message: string;
  fieldErrors: Record<string, string[]>;
}

export function getTaskError(error: unknown): TaskRequestError {
  if (!axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(error)) {
    return {
      status: undefined,
      message: "Unable to process your request. Please try again.",
      fieldErrors: {},
    };
  }
  const status = error.response?.status;
  const messages: Record<number, string> = {
    401: "Your session has expired. Please sign in again.",
    403: "You do not have permission to perform this task action.",
    404: "Task does not exist or has been deleted.",
    409: taskConflictMessage,
    422: "Please check the highlighted fields.",
  };
  return {
    status,
    message:
      ((status === 409 || status === 404) && error.response?.data?.message) ||
      (status && messages[status]) ||
      error.response?.data?.message ||
      "Unable to connect to the server. Please try again.",
    fieldErrors: error.response?.data?.errors ?? {},
  };
}
