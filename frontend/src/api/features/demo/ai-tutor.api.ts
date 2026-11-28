import axiosInstance from "@/api/axios";
import type {
  AiTutorChatResponse,
  AiTutorLanguage,
  AiTutorMessage,
  AiTutorQuizResponse,
} from "@/types/features/demo/ai-tutor";

// The AI can take a while to answer; the default axios timeout may be too short.
const AI_TIMEOUT = { timeout: 90_000 };

const base = (enrollmentId: number, lessonId: number) =>
  `/ai/tutor/enrollments/${enrollmentId}/lessons/${lessonId}`;

export const aiTutorApi = {
  /** Ask the tutor about a lesson. The server keeps no history, so send the recent turns every time. */
  chat: async (
    enrollmentId: number,
    lessonId: number,
    messages: AiTutorMessage[],
    language: AiTutorLanguage = "en",
  ): Promise<AiTutorChatResponse> => {
    const response = await axiosInstance.post<AiTutorChatResponse>(
      `${base(enrollmentId, lessonId)}/chat`,
      { messages, language },
      AI_TIMEOUT,
    );
    return response.data;
  },

  /** Builds a practice quiz from the lesson text. Not graded and not stored. */
  quiz: async (
    enrollmentId: number,
    lessonId: number,
    count = 5,
    language: AiTutorLanguage = "en",
  ): Promise<AiTutorQuizResponse> => {
    const response = await axiosInstance.post<AiTutorQuizResponse>(
      `${base(enrollmentId, lessonId)}/quiz`,
      { count, language },
      AI_TIMEOUT,
    );
    return response.data;
  },
};
