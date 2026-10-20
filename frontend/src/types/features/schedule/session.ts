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

/** Request body for `PATCH /api/v1/sessions/{id}/status` (F15). */
export interface SessionStatusUpdateRequest {
  /** Only COMPLETED or CANCELLED are accepted (SCHEDULED is terminal-exit only). */
  status: Extract<SessionStatus, "COMPLETED" | "CANCELLED">;
  notes?: string | null;
  /** Mandatory when `status = "CANCELLED"`, max 500 characters. */
  cancelReason?: string | null;
  version?: number | null;
}

/** Request body for `POST /api/v1/sessions/{id}/complete` (F15). */
export interface SessionCompleteRequest {
  notes?: string | null;
  version?: number | null;
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
