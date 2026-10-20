import axiosInstance from "@/api/axios";
import { createBaseApiService } from "@/api/base-service.api";
import type {
  ConflictCheckResponse,
  SessionCancelRequest,
  SessionDTO,
  SessionFilter,
  SessionStatus,
} from "@/types";

const path = "/sessions";
const v1Path = "/v1/sessions";

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
});

