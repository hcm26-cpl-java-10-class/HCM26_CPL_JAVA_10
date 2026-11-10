import type { BaseDTO, BaseFilter } from "@/types/common/base";
import type { BacklogPriority, BacklogStatus } from "./backlog-item";
import type { SprintBacklogWorkType } from "./sprint_backlog";

export type SprintStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface SprintDTO extends BaseDTO {
  /** Owning project (used to scope the milestone picker). */
  projectId?: number | null;
  /** Owning team when the sprint was created from a team workspace board. */
  teamId?: number | null;
  name?: string;
  sprintGoal?: string;
  startDate?: string;
  endDate?: string;
  status?: SprintStatus;
  /** Optimistic locking token (read-only). */
  version?: number;
}

export interface SprintFilter extends BaseFilter {
  /** Owning project, used to show only the sprints of the open workspace. */
  projectId?: number;
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
  priority?: BacklogPriority | null;
  status?: BacklogStatus | null;
  /** Story / Bug / Task of the work item. */
  workType?: SprintBacklogWorkType | null;
  /** Owning sprint (`null` = product backlog). */
  sprintId?: number | null;
  assigneeProjectMemberId?: number | null;
  assigneeDisplayName?: string | null;
  startDate?: string | null;
  /** Due date of the item (the backend `endDate`). */
  endDate?: string | null;
  projectId?: number | null;
  /** Linked milestone UUID (UFR-PRJ-003-02). */
  milestoneId?: string | null;
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
