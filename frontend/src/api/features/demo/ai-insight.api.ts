import axiosInstance from "@/api/axios";
import type { AiLanguage } from "@/types/features/demo/ai-course-builder";
import type {
  AiInsightChatMessage,
  AiInsightChatResponse,
  AiSupplementResult,
} from "@/types/features/demo/ai-insight";

const path = "/ai/insights";

// The AI can take a while to read many questions.
const AI_TIMEOUT = { timeout: 90_000 };

export const aiInsightApi = {
  /** Numbers and charts for the first screen (calculated by the system, no AI call). */
  overview: async (courseId: number): Promise<AiInsightChatResponse> => {
    const response = await axiosInstance.get<AiInsightChatResponse>(`${path}/courses/${courseId}/overview`);
    return response.data;
  },

  /** Ask the AI about the course's student questions. The answer comes with charts and percentages. */
  chat: async (
    courseId: number,
    messages: AiInsightChatMessage[],
    language?: AiLanguage,
  ): Promise<AiInsightChatResponse> => {
    const response = await axiosInstance.post<AiInsightChatResponse>(
      `${path}/courses/${courseId}/chat`,
      { messages, language },
      AI_TIMEOUT,
    );
    return response.data;
  },

  /** save = false: draft only. save = true with text: append that reviewed text to the lesson. */
  supplement: async (
    lessonId: number,
    body: {
      topic: string;
      misunderstanding?: string;
      suggestion?: string;
      save?: boolean;
      text?: string;
      language?: AiLanguage;
    },
  ): Promise<AiSupplementResult> => {
    const response = await axiosInstance.post<AiSupplementResult>(
      `${path}/lessons/${lessonId}/supplement`,
      body,
      AI_TIMEOUT,
    );
    return response.data;
  },
};