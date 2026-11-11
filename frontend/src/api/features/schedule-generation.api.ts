import axiosInstance from "../axios";
import type {
  BulkPreviewRequestDTO,
  BulkPreviewResponseDTO,
  BulkSaveSessionsRequestDTO,
  BulkSaveSessionsResponseDTO,
  ScheduleGenerationContextResponse,
} from "@/types/features/schedule-generation";

export const scheduleGenerationApi = {
  /**
   * Lấy ngữ cảnh môn học và giảng viên của lớp
   */
  getContext: async (classId: number | string, signal?: AbortSignal): Promise<ScheduleGenerationContextResponse> => {
    const response = await axiosInstance.get<ScheduleGenerationContextResponse>(
      `/classes/${classId}/schedule-generation/context`, { signal }
    );
    return response.data;
  },

  /**
   * Sinh danh sách buổi học dự kiến trên RAM
   */
  preview: async (
    classId: number | string,
    request: BulkPreviewRequestDTO
  ): Promise<BulkPreviewResponseDTO> => {
    const response = await axiosInstance.post<BulkPreviewResponseDTO>(
      `/classes/${classId}/schedule-generation/preview`,
      request
    );
    return response.data;
  },

  /**
   * Lưu lô các buổi học vào hệ thống (All-or-Nothing)
   */
  save: async (
    classId: number | string,
    request: BulkSaveSessionsRequestDTO,
    idempotencyKey?: string
  ): Promise<BulkSaveSessionsResponseDTO> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }
    const response = await axiosInstance.post<BulkSaveSessionsResponseDTO>(
      `/classes/${classId}/schedule-generation/save`,
      request,
      { headers }
    );
    return response.data;
  },
};
