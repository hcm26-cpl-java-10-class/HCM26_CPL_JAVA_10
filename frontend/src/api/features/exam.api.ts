import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type { ExamDTO, ExamFilter, QuestionDTO, QuestionFilter } from "@/types";

const examBase = createBaseApiService<ExamDTO, ExamFilter>({ path: "/exams" });

export const examApi = {
  ...examBase,
  addQuestions: async (examId: number, questionIds: number[]): Promise<ExamDTO> => {
    const response = await axiosInstance.post<ExamDTO>(`/exams/${examId}/questions`, { questionIds });
    return response.data;
  },
  removeQuestion: async (examId: number, questionId: number): Promise<ExamDTO> => {
    const response = await axiosInstance.delete<ExamDTO>(`/exams/${examId}/questions/${questionId}`);
    return response.data;
  },
};

export const questionApi = createBaseApiService<QuestionDTO, QuestionFilter>({ path: "/questions" });