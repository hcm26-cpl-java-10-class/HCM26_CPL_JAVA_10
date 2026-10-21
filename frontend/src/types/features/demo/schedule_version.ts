import type { BaseDTO, BaseFilter } from "@/types/common/base";

export type ScheduleVersionStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface ScheduleVersionDTO extends BaseDTO {
  classId: string | number;
  versionNumber: number;
  status: ScheduleVersionStatus | string;
  note?: string;
  activatedAt?: string;
  activatedBy?: string;
  clonedFromVersionId?: string;
  previousActiveVersionId?: string;
  totalSessions?: number;
  isEditable?: boolean;
}

export interface ScheduleVersionFilter extends BaseFilter {
  classId?: string | number;
  status?: string;
}

export interface ScheduleVersionConflictIssue {
  code: string;
  candidateKey?: string;
  field?: string;
  message: string;
  relatedSessionId?: number;
  conflictSessionId?: number;
  relatedCandidateKey?: string;
}

export interface ScheduleVersionValidationResult {
  versionId: number;
  valid: boolean;
  issues: ScheduleVersionConflictIssue[];
}
