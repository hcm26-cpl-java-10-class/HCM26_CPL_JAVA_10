import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type {
  AiGradingRequest,
  AiGradingResponse,
  AiReviewQueuePage,
  BatchAiPreviewDTO,
  BatchAiStatusDTO,
  CodingRunResult,
  EssayGradingDetail,
  EssayGradingSummary,
  ExamDTO,
  ExamFilter,
  ExamCategory,
  ExamInvitationOverview,
  ExamLinkOption,
  CourseExam,
  GradeSubmissionRequest,
  QuestionDTO,
  QuestionFilter,
  QuestionGuidelineDTO,
  SimilarityReport,
  StartBatchAiRequest,
  FileFormat,
  ImportResult
} from "@/types";

export interface ExamQuestionPoolConfigRequest {
  randomSelectionEnabled: boolean;
  randomQuestionCount: number;
  shuffleQuestionOrder: boolean;
  questionIds: number[];
}

export interface ExamQuestionPoolConfigResponse {
  examId: number;
  poolVersionId: number;
  versionNumber: number;
  randomSelectionEnabled: boolean;
  randomQuestionCount: number;
  shuffleQuestionOrder: boolean;
  totalQuestions: number;
  questionIds: number[];
}

export interface ExamQuestionPoolVersionHistoryResponse {
  poolVersionId: number;
  versionNumber: number;
  randomSelectionEnabled: boolean;
  randomQuestionCount: number;
  shuffleQuestionOrder: boolean;
  totalQuestions: number;
}

const examBase = createBaseApiService<ExamDTO, ExamFilter>({ path: "/exams" });

export interface GradeScaleDTO {
  id?: number | null;
  gradeLetter: string;
  minScore: number;
  maxScore: number;
  label: string;
  color: string;
  displayOrder?: number;
}

export interface MyScoreInsights {
  attempts: {
    examId: number;
    examTitle: string;
    attemptNumber: number;
    finalScore: number;
    maxScore: number;
    passed: boolean | null;
    startedAt: string | null;
    submittedAt: string;
    durationMinutes: number;
    timeSpentSeconds: number;
  }[];
  classAverages: { examId: number; averagePercent: number; participants: number }[];
  awaitingExamIds: number[];
  pendingAppealExamIds: number[];
  accuracyByExamType: {
    examId: number;
    type: "MULTIPLE_CHOICE" | "ESSAY" | "CODING";
    questionCount: number;
    earned: number;
    possible: number;
  }[];
  courses: {
    courseId: number;
    courseName: string;
    enrolledAt: string | null;
    lessonsTotal: number;
    lessonsCompleted: number;
    examIds: number[];
  }[];
}

export interface PublishedExamScore {
  examId: number;
  examTitle: string;
  category: ExamCategory;
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
  /** Pass score frozen when the attempt started (null when the exam has none). */
  passScore?: number | null;
  /** Passed / not passed; null when unpublished, ungraded or the exam has no pass score. */
  passed?: boolean | null;
}

export const examApi = {
  ...examBase,
  exportExams: async (format: FileFormat, filters?: { search?: string; category?: string; courseId?: number }): Promise<Blob> => {
    const ext = format === "EXCEL" ? "xlsx" : format.toLowerCase();
    const response = await axiosInstance.get(`/exams/export/${ext}`, {
      params: filters,
      responseType: "blob",
    });
    return response.data;
  },
  downloadExamTemplate: async (format: "xlsx" | "csv" = "xlsx"): Promise<Blob> => {
    const response = await axiosInstance.get("/exams/export/template", {
      params: { format },
      responseType: "blob",
    });
    return response.data;
  },
  importExams: async (file: File): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await axiosInstance.post<ImportResult>("/exams/import", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
  getGradeScales: async (examId: number, type: "GRADE" | "PERCENTAGE" = "GRADE"): Promise<GradeScaleDTO[]> => {
    const response = await axiosInstance.get<GradeScaleDTO[]>(`/exams/${examId}/grade-scales`, {
      params: { type },
    });
    return response.data;
  },
  saveGradeScales: async (examId: number, scales: GradeScaleDTO[], type: "GRADE" | "PERCENTAGE" = "GRADE"): Promise<GradeScaleDTO[]> => {
    const response = await axiosInstance.put<GradeScaleDTO[]>(`/exams/${examId}/grade-scales`, scales, {
      params: { type },
    });
    return response.data;
  },
  resetGradeScales: async (examId: number, type: "GRADE" | "PERCENTAGE" = "GRADE"): Promise<void> => {
    await axiosInstance.delete(`/exams/${examId}/grade-scales/reset`, {
      params: { type },
    });
  },
  listInvitationOverviews: async (): Promise<ExamInvitationOverview[]> => {
    const response = await axiosInstance.get<ExamInvitationOverview[]>("/exams/invitations/overview");
    return response.data;
  },
  /** Courses the current user may attach an exam to (a teacher: only the courses they teach). */
  getLinkCourses: async (): Promise<ExamLinkOption[]> => {
    const response = await axiosInstance.get<ExamLinkOption[]>("/exams/link-options/courses");
    return response.data;
  },
  getLinkSections: async (courseId: number): Promise<ExamLinkOption[]> => {
    const response = await axiosInstance.get<ExamLinkOption[]>(`/exams/link-options/courses/${courseId}/sections`);
    return response.data;
  },
  getLinkLessons: async (sectionId: number): Promise<ExamLinkOption[]> => {
    const response = await axiosInstance.get<ExamLinkOption[]>(`/exams/link-options/sections/${sectionId}/lessons`);
    return response.data;
  },
  /** Exams attached to a course (optionally narrowed to a section or lesson). */
  listByCourse: async (courseId: number, params?: { sectionId?: number; lessonId?: number }): Promise<CourseExam[]> => {
    const response = await axiosInstance.get<CourseExam[]>(`/courses/${courseId}/exams`, { params });
    return response.data;
  },
  listBySection: async (sectionId: number): Promise<CourseExam[]> => {
    const response = await axiosInstance.get<CourseExam[]>(`/sections/${sectionId}/exams`);
    return response.data;
  },
  listByLesson: async (lessonId: number): Promise<CourseExam[]> => {
    const response = await axiosInstance.get<CourseExam[]>(`/lessons/${lessonId}/exams`);
    return response.data;
  },
  linkToCurriculum: async (
    courseId: number,
    examId: number,
    params: { sectionId?: number; lessonId?: number }
  ): Promise<CourseExam> => {
    const response = await axiosInstance.put<CourseExam>(`/courses/${courseId}/exams/${examId}/link`, null, { params });
    return response.data;
  },
  unlinkFromCurriculum: async (courseId: number, examId: number, unlinkFromCourse = false): Promise<void> => {
    await axiosInstance.delete(`/courses/${courseId}/exams/${examId}/link`, { params: { unlinkFromCourse } });
  },
  getAvailableExamsForCourse: async (courseId: number): Promise<CourseExam[]> => {
    const response = await axiosInstance.get<CourseExam[]>(`/courses/${courseId}/exams/available`);
    return response.data;
  },
  getMyPublishedExamScores: async (): Promise<PublishedExamScore[]> => {
    const response = await axiosInstance.get<PublishedExamScore[]>("/exams/my-scores");
    return response.data;
  },
  getMyScoreInsights: async (): Promise<MyScoreInsights> => {
    const response = await axiosInstance.get<MyScoreInsights>("/exams/my-scores/insights");
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
  getQuestionGuidelines: async (examId: number, questionId: number): Promise<QuestionGuidelineDTO> => {
    const response = await axiosInstance.get<QuestionGuidelineDTO>(
        `/exams/${examId}/grading/questions/${questionId}/guidelines`
    );
    return response.data;
  },
  submitReferenceAnswer: async (
      examId: number,
      questionId: number,
      referenceAnswer: string
  ): Promise<QuestionGuidelineDTO> => {
    const response = await axiosInstance.put<QuestionGuidelineDTO>(
        `/exams/${examId}/grading/questions/${questionId}/reference`,
        { referenceAnswer }
    );
    return response.data;
  },
  submitRubric: async (
      examId: number,
      questionId: number,
      rubric: string
  ): Promise<QuestionGuidelineDTO> => {
    const response = await axiosInstance.put<QuestionGuidelineDTO>(
        `/exams/${examId}/grading/questions/${questionId}/rubric`,
        { rubric }
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
  previewBatchAiGrading: async (examId: number): Promise<BatchAiPreviewDTO> => {
    const response = await axiosInstance.get<BatchAiPreviewDTO>(`/exams/${examId}/grading/batch-ai/preview`);
    return response.data;
  },
  startBatchAiGrading: async (examId: number, payload?: StartBatchAiRequest): Promise<BatchAiStatusDTO> => {
    const response = await axiosInstance.post<BatchAiStatusDTO>(
      `/exams/${examId}/grading/batch-ai/start`,
      payload || {}
    );
    return response.data;
  },
  getLatestBatchAiStatus: async (examId: number): Promise<BatchAiStatusDTO | null> => {
    const response = await axiosInstance.get<BatchAiStatusDTO | null>(`/exams/${examId}/grading/batch-ai/latest`);
    return response.data || null;
  },
  getBatchAiStatus: async (examId: number, batchId: number): Promise<BatchAiStatusDTO> => {
    const response = await axiosInstance.get<BatchAiStatusDTO>(`/exams/${examId}/grading/batch-ai/${batchId}`);
    return response.data;
  },
  listAiReviewQueue: async (
    examId: number,
    params?: { state?: string; search?: string; page?: number; size?: number }
  ): Promise<AiReviewQueuePage> => {
    const response = await axiosInstance.get<AiReviewQueuePage>(`/exams/${examId}/grading/ai-review-queue`, {
      params,
    });
    return response.data;
  },
  bulkConfirmBatchAiGrades: async (
    examId: number,
    payload: { confirmationText: string; attemptIds?: number[] }
  ): Promise<import("@/types").BulkConfirmAiResultDTO> => {
    const response = await axiosInstance.post<import("@/types").BulkConfirmAiResultDTO>(
      `/exams/${examId}/grading/batch-ai/confirm-all`,
      payload
    );
    return response.data;
  },
  duplicate: async (examId: number): Promise<ExamDTO> => {
    const response = await axiosInstance.post<ExamDTO>(`/exams/${examId}/duplicate`);
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
  // Question Pool - Random Question Selection
  getQuestionPoolConfig: async (examId: number) => {
    const response = await axiosInstance.get<ExamQuestionPoolConfigResponse>(
        `/exams/${examId}/question-pool`
    );
    return response.data;
  },

  saveQuestionPoolConfig: async (
      examId: number,
      request: ExamQuestionPoolConfigRequest
  ) => {
    const response = await axiosInstance.put<ExamQuestionPoolConfigResponse>(
        `/exams/${examId}/question-pool`,
        request
    );
    return response.data;
  },

  getQuestionPoolVersionHistory: async (examId: number) => {
    const response = await axiosInstance.get(
        `/exams/${examId}/question-pool/versions`
    );
    return response.data;
  },
  publish: async (examId: number): Promise<ExamDTO> => {
    const response = await axiosInstance.post<ExamDTO>(`/exams/${examId}/publish`);
    return response.data;
  },
  close: async (examId: number): Promise<ExamDTO> => {
    const response = await axiosInstance.post<ExamDTO>(`/exams/${examId}/close`);
    return response.data;
  },
  archive: async (examId: number): Promise<ExamDTO> => {
    const response = await axiosInstance.post<ExamDTO>(`/exams/${examId}/archive`);
    return response.data;
  },
  returnForRevision: async (
    examId: number,
    attemptId: number,
    payload: { note: string; deadline?: string | null }
  ): Promise<EssayGradingDetail> => {
    const response = await axiosInstance.post<EssayGradingDetail>(
      `/exams/${examId}/grading/attempts/${attemptId}/return-for-revision`,
      payload
    );
    return response.data;
  },
};

export const questionApi = createBaseApiService<QuestionDTO, QuestionFilter>({ path: "/questions" });
