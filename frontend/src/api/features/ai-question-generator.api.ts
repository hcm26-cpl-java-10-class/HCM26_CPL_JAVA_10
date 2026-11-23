import axiosInstance from "@/api/axios";
import type { QuestionDTO } from "@/types/features/exam";
import type {
  AiGeneratorStatus,
  CommitToExamRequest,
  CommitToExamResponse,
  DocumentExtractResponse,
  GenerateRequest,
  GenerateResponse,
  GeneratedQuestion,
  RegenerateSingleRequest,
} from "@/types/features/ai-question-generator";

export const aiQuestionGeneratorApi = {
  getStatus: async (): Promise<AiGeneratorStatus> => {
    const res = await axiosInstance.get<AiGeneratorStatus>("/exams/ai-generator/status");
    return res.data;
  },

  extractDocument: async (file: File): Promise<DocumentExtractResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await axiosInstance.post<DocumentExtractResponse>(
      "/exams/ai-generator/extract-document",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return res.data;
  },

  generate: async (payload: GenerateRequest): Promise<GenerateResponse> => {
    const res = await axiosInstance.post<GenerateResponse>("/exams/ai-generator/generate", payload);
    return res.data;
  },

  regenerateSingle: async (payload: RegenerateSingleRequest): Promise<GeneratedQuestion> => {
    const res = await axiosInstance.post<GeneratedQuestion>("/exams/ai-generator/regenerate-single", payload);
    return res.data;
  },

  commitToExam: async (payload: CommitToExamRequest): Promise<CommitToExamResponse> => {
    const res = await axiosInstance.post<CommitToExamResponse>("/exams/ai-generator/commit-to-exam", payload);
    return res.data;
  },

  getExamAiQuestions: async (examId: number): Promise<QuestionDTO[]> => {
    const res = await axiosInstance.get<QuestionDTO[]>(`/exams/ai-generator/exams/${examId}/questions`);
    return res.data;
  },

  deleteExamAiQuestion: async (examId: number, questionId: number): Promise<void> => {
    await axiosInstance.delete(`/exams/ai-generator/exams/${examId}/questions/${questionId}`);
  },

  cleanupUnusedAiQuestions: async (examId: number): Promise<{ deletedCount: number; message: string }> => {
    const res = await axiosInstance.post<{ deletedCount: number; message: string }>(
      `/exams/ai-generator/exams/${examId}/cleanup`
    );
    return res.data;
  },
};
