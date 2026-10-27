import axiosInstance from "@/api/axios";
import type { LessonQuestion, LessonQuestionPage } from "@/types";

const base = (lessonId: number) => `/lessons/${lessonId}/questions`;

export const qnaApi = {
  list: async (
    lessonId: number,
    page = 0,
    size = 10,
  ): Promise<LessonQuestionPage> => {
    const response = await axiosInstance.get(base(lessonId), {
      params: { page, size },
    });
    // Supports both the classic Spring Page and the DTO page shape ({ page: {...} }).
    const raw = response.data ?? {};
    const meta = raw.page && typeof raw.page === "object" ? raw.page : raw;
    return {
      content: raw.content ?? [],
      totalElements: meta.totalElements ?? 0,
      totalPages: meta.totalPages ?? 0,
      number: meta.number ?? page,
    };
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