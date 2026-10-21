import axiosInstance from "@/api/axios";
import type {
  AttendanceDemoSeedResponse,
  AttendanceHistoryEntry,
  AttendanceRecord,
  AttendanceSheet,
  BulkAttendanceRequest,
  BulkAttendanceResponse,
  CreateAttendanceRecordRequest,
  UpdateAttendanceRecordRequest,
} from "@/types";

const recordsPath = "/v1/attendance-records";
const sessionsPath = "/v1/sessions";

const buildIfMatch = (version?: number | null): Record<string, string> | undefined =>
  version === undefined || version === null ? undefined : { "If-Match": `"${version}"` };

/**
 * T1 / US-DEV6-01 — Session attendance API.
 *
 * Every write sends an `Idempotency-Key` (BR-UNI-20) and reads back a `correlationId`
 * for log cross-checking (NFR-OBS).
 */
export const attendanceApi = {
  /** `GET /api/v1/sessions/{sessionId}/attendance` — attendance sheet (SCR-53). */
  getSessionSheet: async (sessionId: number | string): Promise<AttendanceSheet> => {
    const response = await axiosInstance.get<AttendanceSheet>(
      `${sessionsPath}/${sessionId}/attendance`,
    );
    return response.data;
  },

  /** `GET /api/v1/attendance-records/{id}` */
  getRecord: async (id: number | string): Promise<AttendanceRecord> => {
    const response = await axiosInstance.get<AttendanceRecord>(`${recordsPath}/${id}`);
    return response.data;
  },

  /** `GET /api/v1/attendance-records/{id}/history` — append-only, read-only. */
  getRecordHistory: async (id: number | string): Promise<AttendanceHistoryEntry[]> => {
    const response = await axiosInstance.get<AttendanceHistoryEntry[]>(
      `${recordsPath}/${id}/history`,
    );
    return response.data;
  },

  /** `POST /api/v1/attendance-records` */
  createRecord: async (
    payload: CreateAttendanceRecordRequest,
    idempotencyKey?: string | null,
  ): Promise<AttendanceRecord> => {
    const response = await axiosInstance.post<AttendanceRecord>(recordsPath, payload, {
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    });
    return response.data;
  },

  /** `PATCH /api/v1/attendance-records/{id}` — cập nhật một phần (status, note, reason). */
  updateRecord: async (
    id: number | string,
    payload: UpdateAttendanceRecordRequest,
    options?: { idempotencyKey?: string | null; version?: number | null },
  ): Promise<AttendanceRecord> => {
    const headers: Record<string, string> = {
      ...(buildIfMatch(options?.version ?? payload.version) ?? {}),
    };
    if (options?.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }
    const response = await axiosInstance.patch<AttendanceRecord>(
      `${recordsPath}/${id}`,
      payload,
      { headers },
    );
    return response.data;
  },

  /** `PUT /api/v1/attendance-records/{id}` — full update (status required). */
  replaceRecord: async (
    id: number | string,
    payload: UpdateAttendanceRecordRequest,
    options?: { idempotencyKey?: string | null; version?: number | null },
  ): Promise<AttendanceRecord> => {
    const headers: Record<string, string> = {
      ...(buildIfMatch(options?.version ?? payload.version) ?? {}),
    };
    if (options?.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }
    const response = await axiosInstance.put<AttendanceRecord>(
      `${recordsPath}/${id}`,
      payload,
      { headers },
    );
    return response.data;
  },

  /**
   * `POST /api/v1/sessions/{sessionId}/attendance:demo-seed`
   * Demo helper: creates attendance for the fixed demo cohort (students 2001…2008) that has no
   * record yet. Idempotent per student and disabled when `attendance.demo.enabled=false`.
   */
  seedDemoAttendance: async (sessionId: number | string): Promise<AttendanceDemoSeedResponse> => {
    const response = await axiosInstance.post<AttendanceDemoSeedResponse>(
      `${sessionsPath}/${sessionId}/attendance:demo-seed`,
    );
    return response.data;
  },

  /** `POST /api/v1/sessions/{sessionId}/attendance:bulk` — upsert the whole sheet (UPSERT). */
  bulkUpsert: async (
    sessionId: number | string,
    payload: BulkAttendanceRequest,
    idempotencyKey?: string | null,
  ): Promise<BulkAttendanceResponse> => {
    const response = await axiosInstance.post<BulkAttendanceResponse>(
      `${sessionsPath}/${sessionId}/attendance:bulk`,
      payload,
      { headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined },
    );
    return response.data;
  },
} as const;

export type AttendanceApi = typeof attendanceApi;
