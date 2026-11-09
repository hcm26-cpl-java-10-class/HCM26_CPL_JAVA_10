import axiosInstance from "@/api/axios";
import type {
  AiApplyResult,
  AiChatMessage,
  AiChatResponse,
  AiCourseOutline,
  AiLanguage,
} from "@/types/features/demo/ai-course-builder";

const path = "/ai/course-builder";

export const aiCourseBuilderApi = {
  /** AI asks a question or returns up to 3 outline options. Nothing is saved yet. */
  chat: async (messages: AiChatMessage[], language: AiLanguage = "en"): Promise<AiChatResponse> => {
    // Outline generation can take a while; the default axios timeout may be too short.
    const response = await axiosInstance.post<AiChatResponse>(
      `${path}/chat`,
      { messages, language },
      { timeout: 90_000 },
    );
    return response.data;
  },

  /** Creates the chosen outline as a DRAFT course with sections and lessons. */
  apply: async (course: AiCourseOutline, categoryIds?: number[]): Promise<AiApplyResult> => {
    const response = await axiosInstance.post<AiApplyResult>(`${path}/apply`, {
      course,
      categoryIds,
    });
    return response.data;
  },
};