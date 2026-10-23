import type { BaseDTO, BaseFilter } from "@/types/common/base";

/**
 * Backlog item lifecycle (UFR-PRJ-003-02):
 * Backlog -> Sprint Backlog -> In Progress -> Done.
 */
export type TaskStatus = "BACKLOG" | "SPRINT_BACKLOG" | "IN_PROGRESS" | "DONE";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

/**
 * Backlog item, served by the temporary `backlog_temp` backend module.
 * Reference ids (project, sprint, milestone, assignee) are plain numbers
 * because those modules are not implemented yet.
 */
export interface TaskDTO extends BaseDTO {
  projectId?: number;
  sprintId?: number | null;
  milestoneId?: number | null;
  assigneeProjectMemberId?: number | null;
  title?: string;
  description?: string;
  estimatedHours?: number | null;
  priority?: TaskPriority;
  status?: TaskStatus;
}

export interface TaskFilter extends BaseFilter {
  projectId?: number;
  sprintId?: number;
  milestoneId?: number;
  assigneeProjectMemberId?: number;
  priority?: TaskPriority;
  status?: TaskStatus;
  title?: string;
  minEstimatedHours?: number;
  maxEstimatedHours?: number;
}

/**
 * Audit entry of a backlog item mutation (actor, timestamp, before/after
 * state and correlation id).
 */
export interface TaskAuditLog {
  id: number;
  taskId: number;
  projectId?: number | null;
  action: string;
  actorId?: number | null;
  actorEmail?: string | null;
  correlationId?: string | null;
  beforeState?: string | null;
  afterState?: string | null;
  createdAt: string;
}
