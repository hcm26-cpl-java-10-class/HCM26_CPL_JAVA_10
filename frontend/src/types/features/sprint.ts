import type { BaseDTO, BaseFilter } from "@/types/common/base";
import type { TaskPriority, TaskStatus } from "./task";

export type SprintStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface SprintDTO extends BaseDTO {
  name?: string;
  sprintGoal?: string;
  startDate?: string;
  endDate?: string;
  status?: SprintStatus;
  /** Optimistic locking token (read-only). */
  version?: number;
}

export interface SprintFilter extends BaseFilter {
  status?: SprintStatus;
  startFrom?: string;
  endTo?: string;
}

/**
 * Backlog item as rendered by the Sprint Planning board (UFR-PRJ-003-03).
 * Includes the linked milestone so the UI can warn about deadline conflicts.
 */
export interface SprintPlanningItem {
  id: number;
  title?: string | null;
  description?: string | null;
  priority?: TaskPriority | null;
  status?: TaskStatus | null;
  projectId?: number | null;
  milestoneId?: number | null;
  milestoneName?: string | null;
  milestoneDueDate?: string | null;
  estimatedHours?: number | null;
  sprintOrder?: number | null;
}

/**
 * Snapshot of the Sprint Planning board: sprint header, ordered Sprint Backlog
 * and the items still available in the product backlog.
 */
export interface SprintPlanning {
  sprintId: number;
  sprintName?: string | null;
  sprintGoal?: string | null;
  status?: SprintStatus | null;
  startDate?: string | null;
  endDate?: string | null;
  projectId?: number | null;
  /** False when the sprint is Completed / Cancelled (scope is frozen). */
  canPlan: boolean;
  statusMessage?: string | null;
  sprintItems: SprintPlanningItem[];
  productBacklogItems: SprintPlanningItem[];
}
