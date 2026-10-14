import axiosInstance from "@/api/axios";
import { createBaseApiService } from "@/api/base-service.api";
import type { ConflictCheckResponse, SessionDTO, SessionFilter } from "@/types";

const path = "/sessions";

const base = createBaseApiService<SessionDTO, SessionFilter>({
  path: path,
});

export const sessionApi = Object.assign({}, base, {
  checkConflict: async (payload: SessionDTO, excludeId?: number): Promise<ConflictCheckResponse> => {
    const response = await axiosInstance.post<ConflictCheckResponse>(
      `${path}/check-conflict`,
      payload,
      { params: excludeId ? { excludeId } : undefined }
    );
    return response.data;
  },
});
