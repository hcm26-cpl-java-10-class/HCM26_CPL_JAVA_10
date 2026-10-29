import type { BaseDTO, BaseFilter } from "@/types/common/base";
import type { TaskPriority } from "./task";

/**
 * Lifecycle of a Sprint Backlog item (kept in sync with the backend
 * `SprintBacklogStatus` enum): To do -> In progress -> Review -> Done, with Blocked.
 */
export type SprintBacklogStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE" | "BLOCKED"
  | "CUSTOM_1" | "CUSTOM_2" | "CUSTOM_3" | "CUSTOM_4" | "CUSTOM_5";

/**
 * Work type of a Sprint Backlog item (kept in sync with the backend
 * `SprintBacklogWorkType` enum): Story / Bug / Task.
 * The set is FIXED - users choose one of these values, they never create new
 * work types.
 */
export type SprintBacklogWorkType = "STORY" | "BUG" | "TASK";

/**
 * One task of a sprint, served by the `sprint_backlog` backend module.
 * The assignee is the id of a `project_members` row, picked from the member
 * list of the team that owns the workspace.
 */
export interface SprintBacklogDTO extends BaseDTO {
  /** Owning sprint (mandatory): write it to create / move the item. */
  sprintId?: number | null;
  /** Read-only convenience value so the UI can show the sprint name. */
  sprintName?: string | null;
  /** Owning project (UFR-PRJ-003-02), derived by the backend when omitted. */
  projectId?: number | null;
  /** Linked milestone (UFR-PRJ-003-02). */
  milestoneId?: string | null;
  /** Read-only convenience value so the UI can show the milestone title. */
  milestoneName?: string | null;
  /** Milestone deadline (ISO instant), read-only. */
  milestoneDueDate?: string | null;
  /** Set to `true` to remove the milestone link (update only). */
  clearMilestone?: boolean;
  assigneeProjectMemberId?: number | null;
  /** Set true on update to explicitly clear the current assignee. */
  clearAssignee?: boolean;
  /** Read-only display name resolved for the assigned project member. */
  assigneeDisplayName?: string | null;
  /** `project_members.id` of the reporter (picked in the work item panel). */
  reporterProjectMemberId?: number | null;
  /** Set true on update to explicitly clear the current reporter. */
  clearReporter?: boolean;
  title?: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: SprintBacklogStatus;
  /** Story / Bug / Task (fixed set, `TASK` by default). */
  workType?: SprintBacklogWorkType | null;
  /** Priority of the item (defaults to `MEDIUM` on the backend). */
  priority?: TaskPriority | null;
  /** Optional effort estimate in hours. */
  estimatedHours?: number | null;
  /** Optimistic locking token (read-only). */
  version?: number;
}

/**
 * Member of the team that owns the workspace, offered by the assignee picker
 * of the backlog create bar.
 */
export interface BacklogAssigneeOption {
  /** `project_members.id`, written back as `assigneeProjectMemberId`. */
  id: number;
  userId: number;
  fullName: string;
  userCode?: string | null;
  /** Canonical team role list, for example `"PM,BA"`. */
  role?: string | null;
}

export interface SprintBacklogFilter extends BaseFilter {
  sprintId?: number;
  projectId?: number;
  milestoneId?: string;
  status?: SprintBacklogStatus;
  workType?: SprintBacklogWorkType;
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
