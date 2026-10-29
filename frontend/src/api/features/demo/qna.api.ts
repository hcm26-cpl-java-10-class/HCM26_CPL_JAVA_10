import axiosInstance from "@/api/axios";
import type {
  CourseUnansweredCount,
  LessonQuestion,
  LessonQuestionPage,
  UnansweredQuestionPage,
} from "@/types";

const base = (lessonId: number) => `/lessons/${lessonId}/questions`;

// Supports both the classic Spring Page and the DTO page shape ({ page: {...} }).
function normalizePage<T>(data: any, requestedPage: number) {
  const raw = data ?? {};
  const meta = raw.page && typeof raw.page === "object" ? raw.page : raw;
  return {
    content: (raw.content ?? []) as T[],
    totalElements: (meta.totalElements ?? 0) as number,
    totalPages: (meta.totalPages ?? 0) as number,
    number: (meta.number ?? requestedPage) as number,
  };
}

export const qnaApi = {
  /** `search` filters by keyword in the question or its answers (all words must match). */
  list: async (
    lessonId: number,
    page = 0,
    size = 10,
    search?: string,
  ): Promise<LessonQuestionPage> => {
    const keyword = search?.trim();
    const response = await axiosInstance.get(base(lessonId), {
      params: { page, size, ...(keyword ? { q: keyword } : {}) },
    });
    return normalizePage<LessonQuestion>(response.data, page);
  },

  /** Instructor inbox: unanswered questions across the courses the user teaches (admin: all). */
  listUnanswered: async (params: {
    page?: number;
    size?: number;
    courseId?: number;
    search?: string;
  }): Promise<UnansweredQuestionPage> => {
    const { page = 0, size = 10, courseId, search } = params;
    const keyword = search?.trim();
    const response = await axiosInstance.get("/qna/unanswered", {
      params: {
        page,
        size,
        ...(courseId ? { courseId } : {}),
        ...(keyword ? { q: keyword } : {}),
      },
    });
    return normalizePage<UnansweredQuestionPage["content"][number]>(response.data, page);
  },

  unansweredCourseCounts: async (): Promise<CourseUnansweredCount[]> => {
    const response = await axiosInstance.get<CourseUnansweredCount[]>("/qna/unanswered/courses");
    return response.data ?? [];
  },

  ask: async (lessonId: number, content: string): Promise<LessonQuestion> => {
    const response = await axiosInstance.post<LessonQuestion>(base(lessonId), { content });
    return response.data;
  },

  updateQuestion: async (
    lessonId: number,
    questionId: number,
    content: string,
  ): Promise<LessonQuestion> => {
    const response = await axiosInstance.put<LessonQuestion>(
      `${base(lessonId)}/${questionId}`,
      { content },
    );
    return response.data;
  },

  deleteQuestion: async (lessonId: number, questionId: number): Promise<void> => {
    await axiosInstance.delete(`${base(lessonId)}/${questionId}`);
  },

  answer: async (
    lessonId: number,
    questionId: number,
    content: string,
  ): Promise<LessonQuestion> => {
    const response = await axiosInstance.post<LessonQuestion>(
      `${base(lessonId)}/${questionId}/answers`,
      { content },
    );
    return response.data;
  },

  updateAnswer: async (
    lessonId: number,
    questionId: number,
    answerId: number,
    content: string,
  ): Promise<LessonQuestion> => {
    const response = await axiosInstance.put<LessonQuestion>(
      `${base(lessonId)}/${questionId}/answers/${answerId}`,
      { content },
    );
    return response.data;
  },

  deleteAnswer: async (
    lessonId: number,
    questionId: number,
    answerId: number,
  ): Promise<LessonQuestion> => {
    const response = await axiosInstance.delete<LessonQuestion>(
      `${base(lessonId)}/${questionId}/answers/${answerId}`,
    );
    return response.data;
  },
};