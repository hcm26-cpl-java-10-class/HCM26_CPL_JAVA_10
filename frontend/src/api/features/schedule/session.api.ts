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
   * `PATCH /sessions/{id}/status?status=...`
   * Updates only the session status (no cancel reason required).
   */
  changeStatus: async (
    id: number | string,
    status: SessionStatus
  ): Promise<SessionDTO> => {
    const response = await axiosInstance.patch<SessionDTO>(
      `${v1Path}/${id}/status`,
      null,
      { params: { status } }
    );
    return response.data;
  },

  /**
   * `POST /sessions/{id}/cancel`
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

