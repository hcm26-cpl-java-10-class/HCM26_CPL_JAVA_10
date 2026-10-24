import type { BaseDTO, BaseFilter } from "@/types/common/base";
import type { TaskPriority } from "./task";

/**
 * Lifecycle of a Sprint Backlog item (kept in sync with the backend
 * `SprintBacklogStatus` enum): To do -> In progress -> Review -> Done.
 */
export type SprintBacklogStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

/**
 * One task of a sprint, served by the `sprint_backlog` backend module.
 * The assignee is a plain identifier because the project member module is not
 * implemented yet.
 */
export interface SprintBacklogDTO extends BaseDTO {
  /** Owning sprint (mandatory): write it to create / move the item. */
  sprintId?: number | null;
  /** Read-only convenience value so the UI can show the sprint name. */
  sprintName?: string | null;
  assigneeProjectMemberId?: number | null;
  title?: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: SprintBacklogStatus;
  /** Priority of the item (defaults to `MEDIUM` on the backend). */
  priority?: TaskPriority | null;
  /** Optional effort estimate in hours. */
  estimatedHours?: number | null;
  /** Optimistic locking token (read-only). */
  version?: number;
}

export interface SprintBacklogFilter extends BaseFilter {
  sprintId?: number;
  status?: SprintBacklogStatus;
  priority?: TaskPriority;
  assigneeProjectMemberId?: number;
  startFrom?: string;
  endTo?: string;
}

/**
 * Audit entry of a sprint backlog mutation (actor, timestamp, before/after
 * state and correlation id).
 */
export interface SprintBacklogAuditLog {
  id: number;
  sprintBacklogId: number;
  sprintId?: number | null;
  action: string;
  actorId?: number | null;
  actorEmail?: string | null;
  correlationId?: string | null;
  beforeState?: string | null;
  afterState?: string | null;
  createdAt: string;
}
