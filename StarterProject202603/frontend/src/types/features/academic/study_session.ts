import type { BaseDTO, BaseFilter } from "@/types/common/base";

export type StudySessionType = "LECTURE" | "LAB" | "EXAM";
export type SessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface StudySessionDTO extends BaseDTO {
  subjectId?: number;
  subjectName?: string;
  title?: string;
  sessionDate?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  lecturer?: string;
  type?: StudySessionType;
  description?: string;
  notes?: string;
  status?: SessionStatus;
  cancelReason?: string;
}

export interface StudySessionFilter extends BaseFilter {
  subjectId?: number;
  type?: StudySessionType;
  sessionDate?: { from?: string; to?: string };
  sessionDateFrom?: string;
  sessionDateTo?: string;
}