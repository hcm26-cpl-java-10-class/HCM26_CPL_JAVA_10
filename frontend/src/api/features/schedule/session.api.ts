import axiosInstance from "@/api/axios";
import { createBaseApiService } from "@/api/base-service.api";
import type {
  AuditLogFilter,
  AuditLogPage,
  ConflictCheckResponse,
  SessionCancelRequest,
  SessionDTO,
  SessionFilter,
  SessionNotesUpdateRequest,
  SessionNotesUpdateResponse,
  SessionStatus,
  SessionStatusHistoryEntry,
} from "@/types";

const path = "/sessions";
const v1Path = "/v1/sessions";
const auditPath = "/v1/audit-logs";

const base = createBaseApiService<SessionDTO, SessionFilter>({
  path: path,
});

const buildIfMatch = (version?: number | null): Record<string, string> | undefined =>
  version === undefined || version === null
    ? undefined
    : { "If-Match": `"${version}"` };

export const sessionApi = Object.assign({}, base, {
  checkConflict: async (payload: SessionDTO, excludeId?: number): Promise<ConflictCheckResponse> => {
    const response = await axiosInstance.post<ConflictCheckResponse>(
      `${path}/check-conflict`,
      payload,
      { params: excludeId ? { excludeId } : undefined }
    );
    return response.data;
  },

  /**
   * `GET /api/v1/sessions/{id}`
   * Reads the current status after an operation (F15).
   */
  getStatus: async (id: number | string): Promise<SessionDTO> => {
    const response = await axiosInstance.get<SessionDTO>(`${v1Path}/${id}`);
    return response.data;
  },

  /**
   * `PATCH /api/v1/sessions/{id}/status`
   * Body: `{ status, notes, cancelReason, version }`.
   * Only `COMPLETED` / `CANCELLED` are accepted; `cancelReason` is mandatory when cancelling.
   */
  changeStatus: async (
    id: number | string,
    status: SessionStatus,
    options?: { notes?: string | null; cancelReason?: string | null; version?: number | null }
  ): Promise<SessionDTO> => {
    const ifMatch = buildIfMatch(options?.version);
    const response = await axiosInstance.patch<SessionDTO>(
      `${v1Path}/${id}/status`,
      {
        status,
        notes: options?.notes ?? null,
        cancelReason: options?.cancelReason ?? null,
        version: options?.version ?? null,
      },
      ifMatch ? { headers: ifMatch } : undefined
    );
    return response.data;
  },

  /**
   * `POST /api/v1/sessions/{id}/complete`
   * Shortcut SCHEDULED -> COMPLETED. Requires Calendar Version ACTIVE,
   * class ONGOING and `startTime <= now`.
   */
  complete: async (
    id: number | string,
    payload?: { notes?: string | null; version?: number | null }
  ): Promise<SessionDTO> => {
    const ifMatch = buildIfMatch(payload?.version);
    const response = await axiosInstance.post<SessionDTO>(
      `${v1Path}/${id}/complete`,
      { notes: payload?.notes ?? null, version: payload?.version ?? null },
      ifMatch ? { headers: ifMatch } : undefined
    );
    return response.data;
  },

  /**
   * `POST /api/v1/sessions/{id}/cancel`
   * One-way transition SCHEDULED -> CANCELLED. `cancelReason` is mandatory
   * (max 500 chars). Sends `If-Match` (ETag) when a version is provided.
   *
   * Errors: 404 SESSION_NOT_FOUND, 409 SESSION_VERSION_CONFLICT,
   * 409 SESSION_INVALID_TRANSITION, 422 VALIDATION_FAILED.
   */
  cancel: async (
    id: number | string,
    payload: SessionCancelRequest
  ): Promise<SessionDTO> => {
    const ifMatch = buildIfMatch(payload.version);
    const response = await axiosInstance.post<SessionDTO>(
      `${v1Path}/${id}/cancel`,
      payload,
      ifMatch ? { headers: ifMatch } : undefined
    );
    return response.data;
  },

  /**
   * `PATCH /api/v1/sessions/{id}/notes` (T2 / US-F15-02)
   * Updates `notes` and, when `status` is present, performs the transition while the
   * server records `updatedBy`/`updatedAt`, one `session_status_history` row and one
   * audit-log entry.
   *
   * Send the same `Idempotency-Key` when retrying so the backend replays the previous
   * result instead of creating a second history/audit row (AC T2-04).
   *
   * Errors: 404 SESSION_NOT_FOUND, 409 SESSION_VERSION_CONFLICT,
   * 409 SESSION_INVALID_TRANSITION, 409 IDEMPOTENCY_KEY_REUSED, 422 VALIDATION_FAILED.
   */
  updateNotes: async (
    id: number | string,
    payload: SessionNotesUpdateRequest,
    options?: { idempotencyKey?: string | null; version?: number | null }
  ): Promise<SessionNotesUpdateResponse> => {
    const headers: Record<string, string> = {
      ...(buildIfMatch(options?.version ?? payload.version) ?? {}),
    };
    if (options?.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }

    const response = await axiosInstance.patch<SessionNotesUpdateResponse>(
      `${v1Path}/${id}/notes`,
      payload,
      { headers }
    );
    return response.data;
  },

  /**
   * `GET /api/v1/sessions/{id}/history` (T2)
   * Immutable, append-only list of status transitions. Read-only by design:
   * the backend rejects any write method with 405.
   *
   * Errors: 404 SESSION_NOT_FOUND, 403 FORBIDDEN (trainee / outside assigned scope).
   */
  getHistory: async (id: number | string): Promise<SessionStatusHistoryEntry[]> => {
    const response = await axiosInstance.get<SessionStatusHistoryEntry[]>(
      `${v1Path}/${id}/history`
    );
    return response.data;
  },
});

/**
 * Audit log endpoints (UFR-SYS-014) — Admin/Auditor only.
 */
export const sessionAuditApi = {
  /**
   * `GET /api/v1/audit-logs`
   * Filter by entity/actor/action/correlation or time range; returns a Spring page.
   */
  search: async (filter: AuditLogFilter = {}): Promise<AuditLogPage> => {
    const response = await axiosInstance.get<AuditLogPage>(auditPath, {
      params: filter,
    });
    return response.data;
  },

  /**
   * `GET /api/v1/audit-logs/export` — CSV download (same filters, max 5000 rows).
   */
  exportCsv: async (filter: AuditLogFilter = {}): Promise<Blob> => {
    const response = await axiosInstance.get(`${auditPath}/export`, {
      params: filter,
      responseType: "blob",
    });
    return response.data as Blob;
  },
} as const;

export type SessionAuditApi = typeof sessionAuditApi;

