import type { BaseDTO, BaseFilter } from "@/types/common/base";

/**
 * Backlog item lifecycle (UFR-PRJ-003-02): To do -> In progress -> Review ->
 * Done. Product backlog items stay in To do until they join a sprint.
 */
export type BacklogStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

export type BacklogPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

/**
 * Backlog item, served by the temporary `backlog_temp` backend module.
 * Reference ids (project, sprint, milestone, assignee) are plain numbers
 * because those modules are not implemented yet.
 */
export interface BacklogItemDTO extends BaseDTO {
  projectId?: number;
  sprintId?: number | null;
  milestoneId?: number | null;
  assigneeProjectMemberId?: number | null;
  title?: string;
  description?: string;
  estimatedHours?: number | null;
  priority?: BacklogPriority;
  status?: BacklogStatus;
}

export interface BacklogItemFilter extends BaseFilter {
  projectId?: number;
  sprintId?: number;
  milestoneId?: number;
  assigneeProjectMemberId?: number;
  priority?: BacklogPriority;
  status?: BacklogStatus;
  title?: string;
  minEstimatedHours?: number;
  maxEstimatedHours?: number;
}

/**
 * Audit entry of a backlog item mutation (actor, timestamp, before/after
 * state and correlation id).
 */
export interface BacklogAuditLog {
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
