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
  { value: "LOW", label: "Thấp" },
  { value: "MEDIUM", label: "Trung bình" },
  { value: "HIGH", label: "Cao" },
] as const;

export const taskConflictMessage =
  "Dữ liệu Task đã bị thay đổi bởi thành viên khác, vui lòng tải lại trang";

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
    errors.title = ["Tên task bắt buộc từ 1 - 250 ký tự"];
  }
  const hours = values.estimatedHours.trim();
  if (
    (values.assigneeProjectMemberId && !hours) ||
    (hours && (!Number.isFinite(Number(hours)) || Number(hours) <= 0))
  ) {
    errors.estimatedHours = ["Estimate phải lớn hơn 0"];
  }
  if (values.tags.some((tag) => !tag.trim() || tag.trim().length > 100)) {
    errors.tags = ["Tag bắt buộc từ 1 - 100 ký tự"];
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
      message: "Không thể xử lý yêu cầu. Vui lòng thử lại.",
      fieldErrors: {},
    };
  }
  const status = error.response?.status;
  const messages: Record<number, string> = {
    401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    403: "Bạn không có quyền thực hiện thao tác Task này.",
    404: "Task không tồn tại hoặc đã bị xóa.",
    409: taskConflictMessage,
    422: "Vui lòng kiểm tra lại các trường bị lỗi.",
  };
  return {
    status,
    message:
      ((status === 409 || status === 404) && error.response?.data?.message) ||
      (status && messages[status]) ||
      error.response?.data?.message ||
      "Không kết nối được máy chủ. Vui lòng thử lại.",
    fieldErrors: error.response?.data?.errors ?? {},
  };
}
