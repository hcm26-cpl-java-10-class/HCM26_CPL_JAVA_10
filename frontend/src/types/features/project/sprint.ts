import type { BaseDTO, BaseFilter } from "@/types/common/base";

export type SprintStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface SprintDTO extends BaseDTO {
  projectId?: number;
  /** Display-only, provided by the backend. */
  projectName?: string;
  name?: string;
  sprintGoal?: string;
  startDate?: string;
  endDate?: string;
  status?: SprintStatus;
  /** Optimistic locking token (read-only). */
  version?: number;
}

export interface SprintFilter extends BaseFilter {
  projectId?: number;
  status?: SprintStatus;
  startFrom?: string;
  endTo?: string;
}
