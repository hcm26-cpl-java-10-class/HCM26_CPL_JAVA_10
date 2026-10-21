import type { SessionStatus } from "./session";

/**
 * T1 / US-DEV6-01 — Session attendance (SCR-53).
 *
 * `recordedBy/At`, `updatedBy/At`, `classId`, `calendarVersionId`, `attendanceDate` and
 * `membershipStatus` are server-derived; clients must not send them.
 */
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export type AttendanceMembershipStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "NOT_IN_CLASS"
  | "NOT_FOUND"
  | "UNKNOWN";

export type AttendanceRecordResult = "CREATED" | "UPDATED" | "UNCHANGED" | "REJECTED";

export type AttendanceHistoryAction = "CREATE" | "UPDATE" | "CORRECTION";

export type BulkAttendanceMode = "UPSERT" | "CREATE_ONLY";

/** One attendance record returned by the API. */
export interface AttendanceRecord {
  id: number;
  sessionId: number;
  classId: number;
  calendarVersionId: number;
  studentId: number;
  status: AttendanceStatus;
  note?: string | null;
  /** `YYYY-MM-DD` in the tenant timezone. */
  attendanceDate: string;
  membershipStatus?: AttendanceMembershipStatus | null;
  recordedBy?: number | null;
  recordedAt?: string | null;
  updatedBy?: number | null;
  updatedAt?: string | null;
  /** Used for optimistic locking (`If-Match`). */
  version: number;
  /** `true` when the class is COMPLETED — only ATTENDANCE_UNLOCK can modify it. */
  locked?: boolean;
  correlationId?: string | null;
  idempotentReplay?: boolean;
}

/** `GET /api/v1/sessions/{sessionId}/attendance` */
export interface AttendanceSheet {
  sessionId: number;
  classId?: number | null;
  calendarVersionId?: number | null;
  attendanceDate?: string | null;
  sessionStatus?: SessionStatus | null;
  locked: boolean;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  records: AttendanceRecord[];
  correlationId?: string;
}

/** `POST /api/v1/attendance-records` */
export interface CreateAttendanceRecordRequest {
  sessionId: number;
  studentId: number;
  status: AttendanceStatus;
  note?: string | null;
}

/** `PATCH | PUT /api/v1/attendance-records/{id}` */
export interface UpdateAttendanceRecordRequest {
  status?: AttendanceStatus | null;
  note?: string | null;
  /** Required when the record is LOCKED (class COMPLETED). */
  reason?: string | null;
  version?: number | null;
}

export interface BulkAttendanceItemRequest {
  studentId: number;
  status: AttendanceStatus;
  note?: string | null;
  /** Version the client holds; a mismatch rejects the row with ATTENDANCE_VERSION_CONFLICT. */
  version?: number | null;
}

/** `POST /api/v1/sessions/{sessionId}/attendance:bulk` */
export interface BulkAttendanceRequest {
  mode?: BulkAttendanceMode;
  reason?: string | null;
  items: BulkAttendanceItemRequest[];
}

export interface BulkAttendanceItemResult {
  studentId: number;
  result: AttendanceRecordResult;
  id?: number | null;
  version?: number | null;
  code?: string | null;
  message?: string | null;
  currentVersion?: number | null;
}

export interface BulkAttendanceResponse {
  sessionId: number;
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  rejected: number;
  results: BulkAttendanceItemResult[];
  correlationId?: string;
  idempotentReplay?: boolean;
}

/** `POST /api/v1/sessions/{sessionId}/attendance:demo-seed` (demo helper). */
export interface AttendanceDemoSeedResponse {
  sessionId: number;
  created: number;
  /** Students that already had a record and were left untouched. */
  skipped: number;
  records: AttendanceRecord[];
  correlationId?: string;
}

/** One append-only history row (`GET /api/v1/attendance-records/{id}/history`). */
export interface AttendanceHistoryEntry {
  id: number;
  attendanceId: number;
  sessionId: number;
  studentId: number;
  action: AttendanceHistoryAction;
  fromStatus?: AttendanceStatus | null;
  toStatus: AttendanceStatus;
  fromNote?: string | null;
  toNote?: string | null;
  versionBefore?: number | null;
  versionAfter?: number | null;
  reason?: string | null;
  changedBy: number;
  changedAt: string;
  correlationId?: string | null;
}

/** Unified error body of the attendance module. */
export interface AttendanceApiError {
  status: number;
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]> | null;
  currentVersion?: number | null;
  correlationId?: string;
  timestamp?: string;
}

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
};

export const ATTENDANCE_STATUS_OPTIONS: AttendanceStatus[] = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
];

export const MAX_ATTENDANCE_NOTE_LENGTH = 500;
export const MAX_ATTENDANCE_REASON_LENGTH = 500;
export const MAX_BULK_ATTENDANCE_ROWS = 200;
