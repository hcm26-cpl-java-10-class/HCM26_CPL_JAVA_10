import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type {
  AiGradingRequest,
  AiGradingResponse,
  EssayGradingDetail,
  EssayGradingSummary,
  ExamDTO,
  ExamFilter,
  GradeSubmissionRequest,
  QuestionDTO,
  QuestionFilter,
  SimilarityReport
} from "@/types";

const examBase = createBaseApiService<ExamDTO, ExamFilter>({ path: "/exams" });

export interface PublishedExamScore {
  examId: number;
  examTitle: string;
  attemptId: number;
  attemptNumber: number;
  objectiveScore: number | null;
  finalScore: number | null;
  maxScore: number | null;
  firstScore: number | null;
  secondScore: number | null;
  submittedAt: string;
  /** Giao vien da cong bo ket qua: moi duoc appeal. */
  resultPublished: boolean;
}

export const examApi = {
  ...examBase,
  getMyPublishedExamScores: async (): Promise<PublishedExamScore[]> => {
    const response = await axiosInstance.get<PublishedExamScore[]>("/exams/my-scores");
    return response.data;
  },
  resendResultEmail: async (
    attemptId: number,
    email?: string,
  ): Promise<{ attemptId: number; sent: boolean; message: string }> => {
    const response = await axiosInstance.post<{
      attemptId: number;
      sent: boolean;
      message: string;
    }>(`/exams/attempts/${attemptId}/resend-result-email`, null, {
      params: email ? { email } : undefined,
    });
    return response.data;
  },
  sendTestEmail: async (email: string): Promise<{ sent: boolean; message: string }> => {
    const response = await axiosInstance.post<{ sent: boolean; message: string }>(
      "/exams/mail/test",
      null,
      { params: { email } },
    );
    return response.data;
  },
  addQuestions: async (examId: number, questionIds: number[]): Promise<ExamDTO> => {
    const response = await axiosInstance.post<ExamDTO>(`/exams/${examId}/questions`, { questionIds });
    return response.data;
  },
  listEssayAttempts: async (examId: number): Promise<EssayGradingSummary[]> => {
    const response = await axiosInstance.get<EssayGradingSummary[]>(`/exams/${examId}/grading/attempts`);
    return response.data;
  },
  getEssayAttempt: async (examId: number, attemptId: number): Promise<EssayGradingDetail> => {
    const response = await axiosInstance.get<EssayGradingDetail>(`/exams/${examId}/grading/attempts/${attemptId}`);
    return response.data;
  },
  submitEssayGrade: async (
      examId: number,
      attemptId: number,
      payload: GradeSubmissionRequest
  ): Promise<EssayGradingDetail> => {
    const response = await axiosInstance.post<EssayGradingDetail>(
        `/exams/${examId}/grading/attempts/${attemptId}/grade`,
        payload
    );
    return response.data;
  },
  requestAiEssayGrading: async (
      examId: number,
      attemptId: number,
      payload?: AiGradingRequest
  ): Promise<AiGradingResponse> => {
    const response = await axiosInstance.post<AiGradingResponse>(
        `/exams/${examId}/grading/attempts/${attemptId}/ai-suggest`,
        payload || {}
    );
    return response.data;
  },
  getExamSimilarity: async (examId: number): Promise<SimilarityReport> => {
    const response = await axiosInstance.get<SimilarityReport>(`/exams/${examId}/grading/similarity`);
    return response.data;
  },
  scanExamSimilarity: async (examId: number): Promise<SimilarityReport> => {
    const response = await axiosInstance.post<SimilarityReport>(`/exams/${examId}/grading/similarity/scan`);
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
