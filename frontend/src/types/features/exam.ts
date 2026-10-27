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
  imageUrl?: string | null;
}

export interface QuestionFilter {
  isActive?: boolean;
  type?: QuestionType;
  difficulty?: QuestionDifficulty;
  topic?: string;
}

export type LatePolicy = "NOT_ALLOWED" | "ALLOWED_WITH_PENALTY" | "ALLOWED";
export type ExamType = "MULTIPLE_CHOICE" | "ESSAY" | "MIXED";
export type ExamCategory = "ASSESSMENT" | "PROGRESS_TEST" | "FINAL_TEST";
export type ResultVisibility = "IMMEDIATE" | "AFTER_EXAM_CLOSED" | "MANUAL_RELEASE";

export const EXAM_CATEGORY_LABEL: Record<ExamCategory, string> = {
  ASSESSMENT: "Assessment",
  PROGRESS_TEST: "Progress Test",
  FINAL_TEST: "Final Test",
};

export const EXAM_CATEGORY_SHOW_ANSWERS_DEFAULT: Record<ExamCategory, boolean> = {
  ASSESSMENT: true,
  PROGRESS_TEST: true,
  FINAL_TEST: false,
};

export interface ExamDTO {
  id?: number;
  isActive?: boolean;
  title: string;
  durationMinutes: number;
  startTime?: string | null;
  endTime?: string | null;
  maxAttempts?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  showAnswersAfterExam?: boolean;
  passScore?: number | null;
  maxScore?: number | null;
  latePolicy?: LatePolicy;
  latePenaltyPercent?: number | null;
  lateGraceMinutes?: number;
  resultVisibility?: ResultVisibility;
  category?: ExamCategory;
  examType?: ExamType;
  questionIds?: number[];
  questions?: QuestionDTO[];
  totalPoints?: number;
  accessCode?: string | null;
  hasPassword?: boolean;
  // NEW (anti-cheat)
  antiCheatEnabled?: boolean;
  detectTabSwitch?: boolean;
  blockCopyPaste?: boolean;
  requireFullscreen?: boolean;
  singleSession?: boolean;
  flagThreshold?: number | null;
}

export interface ExamFilter {
  title?: string;
  isActive?: boolean;
  category?: ExamCategory;
}

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
  maxScore?: number;
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
  maxScore?: number;
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

export interface CriterionScore {
  criterion: string;
  maxPoints?: number;
  awardedPoints: number;
  comment?: string;
}

export interface AiQuestionProposal {
  questionId: number;
  proposedScore: number;
  feedback: string;
  reasoning?: string;
  analysis?: string;
  criterionScores?: CriterionScore[];
  flagAmbiguous?: boolean;
  flagReason?: string;
}

export interface QuestionContextInput {
  referenceAnswer?: string;
  rubric?: string;
}

export interface AiGradingRequest {
  questions?: Record<number, QuestionContextInput>;
}

export interface AiGradingResponse {
  model?: string;
  proposals: AiQuestionProposal[];
}
