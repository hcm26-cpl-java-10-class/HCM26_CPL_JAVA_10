import axiosInstance from "@/api/axios";
import type {
  AttemptSubmission,
  IntegrityEventDTO,
} from "@/api/exam.api";
import type {
  ScoreAppealAdjustmentDTO,
  ScoreAppealCreateRequest,
  ScoreAppealDTO,
  ScoreAppealReviewRequest,
} from "@/types/features/score-appeal";

export const scoreAppealApi = {
  create: async (attemptId: number, payload: ScoreAppealCreateRequest): Promise<ScoreAppealDTO> => {
    const response = await axiosInstance.post<ScoreAppealDTO>(
      `/exams/attempts/${attemptId}/appeals`,
      payload
    );
    return response.data;
  },
  getMyAppeals: async (): Promise<ScoreAppealDTO[]> => {
    const response = await axiosInstance.get<ScoreAppealDTO[]>("/exams/appeals/my");
    return response.data;
  },
  getAll: async (): Promise<ScoreAppealDTO[]> => {
    const response = await axiosInstance.get<ScoreAppealDTO[]>("/exams/appeals");
    return response.data;
  },
  getPending: async (): Promise<ScoreAppealDTO[]> => {
    const response = await axiosInstance.get<ScoreAppealDTO[]>("/exams/appeals/pending");
    return response.data;
  },
  getByExam: async (examId: number): Promise<ScoreAppealDTO[]> => {
    const response = await axiosInstance.get<ScoreAppealDTO[]>(`/exams/${examId}/appeals`);
    return response.data;
  },
  getById: async (appealId: number): Promise<ScoreAppealDTO> => {
    const response = await axiosInstance.get<ScoreAppealDTO>(`/exams/appeals/${appealId}`);
    return response.data;
  },
  review: async (appealId: number, payload: ScoreAppealReviewRequest): Promise<ScoreAppealDTO> => {
    const response = await axiosInstance.post<ScoreAppealDTO>(
      `/exams/appeals/${appealId}/review`,
      payload
    );
    return response.data;
  },
  getHistory: async (attemptId: number): Promise<ScoreAppealAdjustmentDTO[]> => {
    const response = await axiosInstance.get<ScoreAppealAdjustmentDTO[]>(
      `/exams/attempts/${attemptId}/appeal-history`
    );
    return response.data;
  },
  getSubmission: async (attemptId: number): Promise<AttemptSubmission> => {
    const response = await axiosInstance.get<AttemptSubmission>(
      `/exams/attempts/${attemptId}/submission`
    );
    return response.data;
  },
  getIntegrityEvents: async (attemptId: number): Promise<IntegrityEventDTO[]> => {
    const response = await axiosInstance.get<IntegrityEventDTO[]>(
      `/exams/attempts/${attemptId}/integrity-events`
    );
    return response.data;
  },
};
