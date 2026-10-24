import type { TaskDTO, TaskPayload, TaskPriority } from "@/types/features/task";
import axios from "axios";

export interface TaskFormValues {
  title: string;
  description: string;
  assigneeProjectMemberId: string;
  estimatedHours: string;
  priority: TaskPriority;
  tags: string[];
}

export type TaskFieldErrors = Record<string, string[] | undefined>;

export const taskStatusOptions = [
  { value: "TODO", label: "To Do" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "REVIEW", label: "Review" },
  { value: "DONE", label: "Done" },
  { value: "BLOCKED", label: "Blocked" },
] as const;

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

export function taskListPath(projectId: string): string {
  return projectId ? `/tasks?${new URLSearchParams({ projectId })}` : "/tasks";
}

export function toTaskFormValues(task?: TaskDTO): TaskFormValues {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    assigneeProjectMemberId: task?.assigneeProjectMemberId ?? "",
    estimatedHours: task?.estimatedHours == null ? "" : String(task.estimatedHours),
    priority: task?.priority ?? "MEDIUM",
    tags: task?.tags ?? [],
  };
}

export function normalizeTags(tags: string[]): string[] {
  const names = new Map<string, string>();
  for (const tag of tags) {
    const name = tag.trim();
    if (!names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
  }
  return [...names.values()];
}

export function validateTaskForm(values: TaskFormValues): TaskFieldErrors {
  const errors: TaskFieldErrors = {};
  const title = values.title.trim();
  if (!title || title.length > 250) {
    errors.title = ["Task title must contain 1 to 250 characters"];
  }
  if (values.assigneeProjectMemberId && !isProjectId(values.assigneeProjectMemberId)) {
    errors.assigneeProjectMemberId = ["Please select a valid project member"];
  }
  const hours = values.estimatedHours.trim();
  if (
    (values.assigneeProjectMemberId && !hours) ||
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
  if (values.tags.some((tag) => !tag.trim() || tag.trim().length > 100)) {
    errors.tags = ["Tags must contain 1 to 100 characters"];
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
    assigneeProjectMemberId: values.assigneeProjectMemberId || null,
    title: values.title.trim(),
    description: values.description.trim() || null,
    estimatedHours: values.estimatedHours.trim() ? Number(values.estimatedHours) : null,
    priority: values.priority,
    tags: normalizeTags(values.tags),
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
