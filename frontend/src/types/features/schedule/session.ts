import type { BaseDTO } from "@/types/common/base";

export type SessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface SessionDTO extends BaseDTO {
  calendarVersionId?: number;
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

/**
 * Request body for `PATCH /api/v1/sessions/{id}/notes` (T2 / US-F15-02).
 * Omit `status` to only update the notes; `reason` is mandatory when cancelling.
 */
export interface SessionNotesUpdateRequest {
  status?: Extract<SessionStatus, "COMPLETED" | "CANCELLED"> | null;
  /** Max 2000 characters (OD-F15-03). */
  notes?: string | null;
  /** Max 500 characters; mandatory when `status = "CANCELLED"`. */
  reason?: string | null;
  version?: number | null;
}

/** Response of `PATCH /api/v1/sessions/{id}/notes` — audit info is server-set (BR-SES-06). */
export interface SessionNotesUpdateResponse {
  sessionId: number;
  status?: SessionStatus;
  notes?: string | null;
  version?: number;
  updatedBy?: number;
  updatedAt?: string;
  /** History row created by the transition (null when only notes were updated). */
  historyId?: number | null;
  correlationId?: string;
  /** True when the result came from a previous request with the same Idempotency-Key. */
  idempotentReplay?: boolean;
}

/** One row of `GET /api/v1/sessions/{id}/history` (immutable, append-only — BR-SES-07). */
export interface SessionStatusHistoryEntry {
  id: number;
  sessionId: number;
  fromStatus?: SessionStatus | null;
  toStatus: SessionStatus;
  reason?: string | null;
  changedBy: number;
  changedAt: string;
  correlationId?: string | null;
}

export type SessionAuditAction = "SESSION_STATUS_CHANGE" | "SESSION_NOTES_UPDATE";

/** One row of `GET /api/v1/audit-logs` (UFR-SYS-014). */
export interface AuditLogEntry {
  id: number;
  actorId: number;
  action: SessionAuditAction;
  entityType: string;
  entityId: number;
  beforeState?: string | null;
  afterState?: string | null;
  reason?: string | null;
  correlationId?: string | null;
  createdAt: string;
}

/** Filters for `GET /api/v1/audit-logs` and `GET /api/v1/audit-logs/export`. */
export interface AuditLogFilter {
  entityType?: string;
  entityId?: number;
  actorId?: number;
  action?: SessionAuditAction;
  correlationId?: string;
  /** ISO-8601 date-time. */
  from?: string;
  /** ISO-8601 date-time. */
  to?: string;
  page?: number;
  size?: number;
}

/** Raw Spring Data page envelope returned by `GET /api/v1/audit-logs`. */
export interface AuditLogPage {
  content: AuditLogEntry[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first?: boolean;
  last?: boolean;
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
