import type { BaseFilter } from "@/types/common/base";

export type TrainingClassStatus = "PLANNING" | "ONGOING" | "COMPLETED" | "CANCELLED";

export interface TrainingClassDTO {
  id: number;
  code: string;
  name: string;
  programId: number;
  programName: string;
  cohortId: number | null;
  cohortName: string;
  tenantId: number;
  mentorId: number | null;
  status: TrainingClassStatus;
  memberCount: number;
}

export interface TrainingClassFilter extends BaseFilter {
  status?: TrainingClassStatus;
  programId?: number;
  programName?: string;
  cohortId?: number;
  cohortName?: string;
}
