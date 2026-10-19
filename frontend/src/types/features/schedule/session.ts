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
  cancelReason?: string;
  isOverridden?: boolean;
  overrideReason?: string;
  forceOverride?: boolean;
  /** Optimistic-locking version, returned read-only by the backend (used for If-Match). */
  version?: number;
}

/** Request body for `POST /sessions/{id}/cancel` (F15 / BR-SES-03). */
export interface SessionCancelRequest {
  /** Mandatory cancellation reason, max 500 characters. */
  cancelReason: string;
  notes?: string;
  /** Client-held version; used when the `If-Match` header is not sent. */
  version?: number;
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
