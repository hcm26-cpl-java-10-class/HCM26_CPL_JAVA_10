import axiosInstance from "@/api/axios";
import type {
  AiApplyResult,
  AiChatMessage,
  AiChatResponse,
  AiCourseOutline,
  AiGenerateContentResult,
  AiLanguage,
  AiOptionsResponse,
} from "@/types/features/demo/ai-course-builder";

const path = "/ai/course-builder";

// Writing a lesson can take a while; the default axios timeout may be too short.
const AI_TIMEOUT = { timeout: 90_000 };

export const aiCourseBuilderApi = {
  /** Teachers and categories for the pickers. */
  options: async (): Promise<AiOptionsResponse> => {
    const response = await axiosInstance.get<AiOptionsResponse>(`${path}/options`);
    return response.data;
  },

  /** AI asks a question or returns up to 3 outline options. Nothing is saved yet. */
  chat: async (messages: AiChatMessage[], language: AiLanguage = "en"): Promise<AiChatResponse> => {
    const response = await axiosInstance.post<AiChatResponse>(
      `${path}/chat`,
      { messages, language },
      AI_TIMEOUT,
    );
    return response.data;
  },

  /** Creates the chosen outline as a DRAFT course with sections and lessons. */
  apply: async (
    course: AiCourseOutline,
    categoryIds?: number[],
    instructorId?: number | null,
  ): Promise<AiApplyResult> => {
    const response = await axiosInstance.post<AiApplyResult>(`${path}/apply`, {
      course,
      categoryIds,
      instructorId: instructorId ?? null,
    });
    return response.data;
  },

  /** Writes the full text of an existing lesson and (save = true) stores it. */
  generateLessonContent: async (
    lessonId: number,
    options: { save?: boolean; overwrite?: boolean; language?: AiLanguage } = {},
  ): Promise<AiGenerateContentResult> => {
    const response = await axiosInstance.post<AiGenerateContentResult>(
      `${path}/lessons/${lessonId}/generate-content`,
      options,
      AI_TIMEOUT,
    );
    return response.data;
  },

  /** Drafts lesson text from the lesson form (works before the lesson is saved). Nothing is saved. */
  draftLessonContent: async (
    sectionId: number,
    body: { title: string; notes?: string; lessonId?: number; language?: AiLanguage },
  ): Promise<AiGenerateContentResult> => {
    const response = await axiosInstance.post<AiGenerateContentResult>(
      `${path}/sections/${sectionId}/draft-lesson-content`,
      body,
      AI_TIMEOUT,
    );
    return response.data;
  },
};