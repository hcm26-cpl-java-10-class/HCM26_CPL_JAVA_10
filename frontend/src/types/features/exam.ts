// CHANGED: chỉ còn 2 loại (trước đây: SINGLE_CHOICE | MULTI_CHOICE | ESSAY)
export type QuestionType = "MULTIPLE_CHOICE" | "ESSAY";
export type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD";

export interface QuestionOptionDTO {
  id?: number;
  content: string;
  correct: boolean;
  imageUrl?: string | null;
}

export interface QuestionDTO {
  id: number;
  isActive: boolean;
  content: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  topic?: string | null;
  points: number;
  sourceQuestionId?: number | null;
  options: QuestionOptionDTO[];
}

export interface QuestionFilter {
  isActive?: boolean;
  type?: QuestionType;
  difficulty?: QuestionDifficulty;
  topic?: string;
}

export type LatePolicy = "NOT_ALLOWED" | "ALLOWED_WITH_PENALTY" | "ALLOWED";
export type ResultVisibility = "IMMEDIATE" | "AFTER_EXAM_CLOSED" | "MANUAL_RELEASE";

export interface ExamDTO {
  id?: number;
  isActive?: boolean;
  title: string;
  durationMinutes: number;
  // Cấu hình kỳ thi (UFR-EXM-002). Dạng "YYYY-MM-DDTHH:mm[:ss]", null = không giới hạn
  startTime?: string | null;
  endTime?: string | null;
  maxAttempts?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  passScore?: number | null;
  latePolicy?: LatePolicy;
  latePenaltyPercent?: number | null;
  lateGraceMinutes?: number;
  resultVisibility?: ResultVisibility;
  questionIds?: number[];
  questions?: QuestionDTO[];
  totalPoints?: number;
  accessCode?: string | null;
  hasPassword?: boolean;
}

export interface ExamFilter {
  title?: string;
  isActive?: boolean;
}

// ===== NEW: giáo viên xem bài tự luận cần chấm =====
export type EssayAttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "PENDING_REVIEW" | "EXPIRED";

export interface EssayGradingSummary {
  attemptId: number;
  studentId: number;
  studentName: string;
  studentEmail: string;
  attemptNumber: number;
  status: EssayAttemptStatus;
  submittedAt: string | null;
  essayCount: number;
  essayAnswered: number;
}

export interface EssayGradingItem {
  questionId: number;
  displayOrder: number;
  content: string;
  points: number;
  answerText: string;
  score?: number | null;
  feedback?: string | null;
}

export interface EssayGradingDetail {
  attemptId: number;
  examId: number;
  examTitle: string;
  studentId: number;
  studentName: string;
  studentEmail: string;
  attemptNumber: number;
  status: EssayAttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  totalPoints: number;
  objectiveScore: number | null;
  finalScore?: number | null;
  alreadyGraded?: boolean;
  essays: EssayGradingItem[];
}

export interface QuestionGradeInput {
  questionId: number;
  score: number;
  feedback?: string;
}

export interface GradeSubmissionRequest {
  grades: QuestionGradeInput[];
  confirmOverwrite?: boolean;
}

export interface AiQuestionProposal {
  questionId: number;
  proposedScore: number;
  feedback: string;
  reasoning?: string;
}

export interface AiGradingResponse {
  proposals: AiQuestionProposal[];
}

