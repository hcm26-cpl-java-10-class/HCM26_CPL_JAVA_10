export type TaskPriority = "HIGH" | "MEDIUM" | "LOW";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE" | "BLOCKED";

export interface TaskPayload {
  projectId: string;
  sprintId: string | null;
  milestoneId: string | null;
  assigneeProjectMemberId: string | null;
  title: string;
  description: string | null;
  estimatedHours: number | null;
  priority: TaskPriority;
  tags: string[];
  version?: number;
}

export interface TaskDTO extends TaskPayload {
  id: string;
  status: TaskStatus;
  version: number;
  isActive: boolean;
  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskFilter {
  projectId: string;
  priority?: TaskPriority;
  status?: TaskStatus;
}
