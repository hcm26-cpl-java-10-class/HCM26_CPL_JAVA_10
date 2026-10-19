import axiosInstance from "@/api/axios";
import type {
  BulkPreviewRequestDTO,
  BulkPreviewResponseDTO,
  BulkSaveSessionsRequestDTO,
  BulkSaveSessionsResponseDTO,
  ScheduleGenerationContextResponse,
} from "@/types";

export const bulkSessionGenerationApi = {
  getContext: async (classId: number): Promise<ScheduleGenerationContextResponse> => {
    const response = await axiosInstance.get<ScheduleGenerationContextResponse>(
      `/v1/classes/${classId}/schedule-generation/context`
    );
    return response.data;
  },

  generatePreview: async (
    classId: number,
    payload: BulkPreviewRequestDTO
  ): Promise<BulkPreviewResponseDTO> => {
    const response = await axiosInstance.post<BulkPreviewResponseDTO>(
      `/v1/classes/${classId}/schedule-generation/preview`,
      payload
    );
    return response.data;
  },

  saveBulkSessions: async (
    versionId: number,
    payload: BulkSaveSessionsRequestDTO,
    idempotencyKey?: string
  ): Promise<BulkSaveSessionsResponseDTO> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }
    const response = await axiosInstance.post<BulkSaveSessionsResponseDTO>(
      `/v1/calendar-versions/${versionId}/bulk-sessions`,
      payload,
      { headers }
    );
    return response.data;
  },
};
