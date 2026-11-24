import axiosInstance from "@/api/axios";
import type {
  AiCompareRequest,
  AiCompareResponse,
  AiFollowUpAnswer,
  AiFollowUpRequest,
  AiOutlineRequest,
  AiOutlineResponse,
  AiSummaryRequest,
  AiSummaryResponse,
} from "@/types/features/demo/course-ai-comparison";

const path = "/reports/course-comparison/ai";

// Phân tích AI mất vài chục giây (gọi Gemini + dựng payload) nên timeout riêng.
const AI_TIMEOUT = { timeout: 120_000 };

export const courseAiComparisonApi = {
  /** Phân tích so sánh: 1 khóa mục tiêu + N khóa đối chiếu. */
  analyze: async (request: AiCompareRequest): Promise<AiCompareResponse> => {
    const response = await axiosInstance.post<AiCompareResponse>(
      `${path}/analyze`,
      request,
      AI_TIMEOUT,
    );
    return response.data;
  },

  /** Hỏi đáp tiếp về kết quả so sánh (multi-turn). */
  ask: async (request: AiFollowUpRequest): Promise<AiFollowUpAnswer> => {
    const response = await axiosInstance.post<AiFollowUpAnswer>(
      `${path}/ask`,
      request,
      AI_TIMEOUT,
    );
    return response.data;
  },

  /** So sánh cấu trúc nội dung (outline) giữa các khóa học. */
  compareOutline: async (request: AiOutlineRequest): Promise<AiOutlineResponse> => {
    const response = await axiosInstance.post<AiOutlineResponse>(
      `${path}/outline`,
      request,
      AI_TIMEOUT,
    );
    return response.data;
  },

  /** Tóm tắt ngắn từ kết quả phân tích đã có. */
  summarize: async (request: AiSummaryRequest): Promise<AiSummaryResponse> => {
    const response = await axiosInstance.post<AiSummaryResponse>(
      `${path}/summary`,
      request,
      AI_TIMEOUT,
    );
    return response.data;
  },
};
