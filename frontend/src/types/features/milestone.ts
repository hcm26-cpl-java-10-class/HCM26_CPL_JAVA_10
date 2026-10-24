/**
 * Milestone reference used by the temporary `backlog_temp` backend module.
 * The milestone module itself is not implemented yet, so the backlog item form
 * only consumes a read-only list of linkable milestones.
 */
export type MilestoneStatus =
  | "PLANNED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";

export interface MilestoneOption {
  id: number;
  projectId: number;
  name: string;
  /** Name prefixed with the project, used as the selector label. */
  label: string;
  status: MilestoneStatus;
  dueDate?: string | null;
}
