import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type {
  AiGradingRequest,
  AiGradingResponse,
  CodingRunResult,
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
  attemptNumber: number;
  objectiveScore: number | null;
  finalScore: number | null;
  maxScore: number | null;
  firstScore: number | null;
  secondScore: number | null;
  submittedAt: string;
  /** Id của lần làm bài, dùng để định danh khiếu nại điểm. */
  attemptId: number;
  /** Kết quả đã được giáo viên công bố hay chưa (chỉ khi công bố mới được khiếu nại). */
  resultPublished: boolean;
}

export const examApi = {
  ...examBase,
  getMyPublishedExamScores: async (): Promise<PublishedExamScore[]> => {
    const response = await axiosInstance.get<PublishedExamScore[]>("/exams/my-scores");
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
  runCodingTests: async (examId: number, attemptId: number, questionId: number): Promise<CodingRunResult> => {
    const response = await axiosInstance.post<CodingRunResult>(
        `/exams/${examId}/grading/attempts/${attemptId}/coding/${questionId}/run`
    );
    return response.data;
  },
  regradeCoding: async (examId: number, attemptId: number, questionId: number): Promise<EssayGradingDetail> => {
    const response = await axiosInstance.post<EssayGradingDetail>(
        `/exams/${examId}/grading/attempts/${attemptId}/coding/${questionId}/regrade`
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
