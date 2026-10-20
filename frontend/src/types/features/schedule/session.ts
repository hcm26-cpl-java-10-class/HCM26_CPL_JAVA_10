import type { BaseDTO } from "@/types/common/base";
import type { CalendarVersionStatus } from "./calendar-version";

export type SessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface SessionDTO extends BaseDTO {
  calendarVersionId?: number;
  calendarVersionNumber?: number;
  calendarVersionStatus?: CalendarVersionStatus;
  classId?: number;
  topicId?: number;
  classCode: string;
  topicName?: string;
  trainerId: number;
  trainerName: string;
  title: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  meetingLink?: string | null;
  status?: SessionStatus;
  notes?: string;
  cancelReason?: string;
  isOverridden?: boolean;
  overrideReason?: string;
  forceOverride?: boolean;
  version?: number;
}

export interface SessionClassInfo {
  id: number;
  code: string;
  name?: string;
  startDate?: string;
  endDate?: string;
}

export interface SessionCancelRequest {
  cancelReason: string;
  notes?: string;
  version?: number;
}

export interface SessionFilter {
  classCode?: string;
  topicName?: string;
  trainerId?: number;
  status?: SessionStatus;
  room?: string;
  calendarVersionId?: number;
}

export interface ConflictCheckResponse {
  hasConflict: boolean;
  message?: string;
  conflictingSessions?: SessionDTO[];
}
