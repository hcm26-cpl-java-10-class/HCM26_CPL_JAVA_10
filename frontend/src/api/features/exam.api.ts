import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type { EssayGradingDetail, EssayGradingSummary, ExamDTO, ExamFilter, QuestionDTO, QuestionFilter } from "@/types";

const examBase = createBaseApiService<ExamDTO, ExamFilter>({ path: "/exams" });

export const examApi = {
  ...examBase,
  addQuestions: async (examId: number, questionIds: number[]): Promise<ExamDTO> => {
    const response = await axiosInstance.post<ExamDTO>(`/exams/${examId}/questions`, { questionIds });
    return response.data;
  },
  // NEW: giáo viên xem bài tự luận cần chấm của một đề
  listEssayAttempts: async (examId: number): Promise<EssayGradingSummary[]> => {
    const response = await axiosInstance.get<EssayGradingSummary[]>(`/exams/${examId}/grading/attempts`);
    return response.data;
  },
  getEssayAttempt: async (examId: number, attemptId: number): Promise<EssayGradingDetail> => {
    const response = await axiosInstance.get<EssayGradingDetail>(`/exams/${examId}/grading/attempts/${attemptId}`);
    return response.data;
  },
  removeQuestion: async (examId: number, questionId: number): Promise<ExamDTO> => {
    const response = await axiosInstance.delete<ExamDTO>(`/exams/${examId}/questions/${questionId}`);
    return response.data;
  },
  updateQuestion: async (examId: number, questionId: number, payload: QuestionDTO): Promise<ExamDTO> => {
    const response = await axiosInstance.put<ExamDTO>(`/exams/${examId}/questions/${questionId}`, payload);
    return response.data;
  },
};

export const questionApi = createBaseApiService<QuestionDTO, QuestionFilter>({ path: "/questions" });