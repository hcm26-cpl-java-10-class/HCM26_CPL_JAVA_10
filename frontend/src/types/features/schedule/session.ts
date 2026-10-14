import type { BaseDTO } from "@/types/common/base";

export type SessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface SessionDTO extends BaseDTO {
  classCode: string;
  topicName?: string;
  trainerId: number;
  trainerName: string;
  title: string;
  startTime: string; // ISO-8601 string: yyyy-MM-ddTHH:mm:ss
  endTime: string;
  room?: string;
  meetingLink?: string;
  status?: SessionStatus;
  notes?: string;
  isOverridden?: boolean;
  overrideReason?: string;
  forceOverride?: boolean;
}

export interface SessionFilter {
  classCode?: string;
  topicName?: string;
  trainerId?: number;
  status?: SessionStatus;
  room?: string;
}

export interface ConflictCheckResponse {
  hasConflict: boolean;
  message?: string;
  conflictingSessions?: SessionDTO[];
}
