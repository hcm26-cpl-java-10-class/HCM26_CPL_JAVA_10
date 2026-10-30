export type QuestionType = "MULTIPLE_CHOICE" | "ESSAY" | "CODING";

export const CODE_TYPES = [
  "int",
  "long",
  "double",
  "boolean",
  "String",
  "int[]",
  "String[]",
] as const;
export type CodeType = (typeof CODE_TYPES)[number];

export interface CodeParam {
  name: string;
  type: string;
}
export interface CodeTestCase {
  inputs: string[];
  expected: string;
  visible: boolean;
}
export interface CodeSpec {
  functionName: string;
  returnType: string;
  params: CodeParam[];
  tests: CodeTestCase[];
  starterCode?: string | null;
}
export type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD";

export interface QuestionOptionDTO {
  id?: number;
  content: string;
  correct: boolean;
  imageUrl?: string | null;
}

export interface EssayGradingCriterion {
  name: string;
  description?: string | null;
  weightPercentage: number;
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
  gradingCriteria?: EssayGradingCriterion[];
  options: QuestionOptionDTO[];
  imageUrl?: string | null;
  code?: CodeSpec | null;
}

export interface QuestionFilter {
  isActive?: boolean;
  type?: QuestionType;
  difficulty?: QuestionDifficulty;
  topic?: string;
}

export type LatePolicy = "NOT_ALLOWED" | "ALLOWED_WITH_PENALTY" | "ALLOWED";
export type ExamType = "MULTIPLE_CHOICE" | "ESSAY" | "CODING" | "MC_CODING" | "MIXED";
export type ExamCategory = "ASSESSMENT" | "QUIZ" | "MIDTERM" | "FINAL_TEST";
export type ResultVisibility = "IMMEDIATE" | "AFTER_EXAM_CLOSED" | "MANUAL_RELEASE";

export const EXAM_CATEGORY_LABEL: Record<ExamCategory, string> = {
  ASSESSMENT: "Assessment",
  QUIZ: "Quiz",
  MIDTERM: "Midterm",
  FINAL_TEST: "Final Test",
};

export const EXAM_CATEGORY_SHOW_ANSWERS_DEFAULT: Record<ExamCategory, boolean> = {
  ASSESSMENT: true,
  QUIZ: true,
  MIDTERM: false,
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
  codingCount?: number;
  codingAnswered?: number;
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
  gradingCriteria?: EssayGradingCriterion[];
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
  codings?: CodingGradingItem[];
}

export interface CodingGradingItem {
  questionId: number;
  displayOrder: number;
  content: string;
  points: number;
  maxScore?: number;
  code: string;
  score?: number | null;
  feedback?: string | null;
  spec?: CodeSpec | null;
}

export interface CodingTestResult {
  index: number;
  visible: boolean;
  passed: boolean;
  status: string;
  inputs: string[];
  expected: string;
  actual: string | null;
  error: string | null;
}

export interface CodingRunResult {
  passed: number;
  total: number;
  infraError: boolean;
  tests: CodingTestResult[];
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
  explanation?: string;
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

export interface SimilarPair {
  pairId: string;
  questionId: number;
  questionDisplayOrder: number;
  questionContent: string;
  attemptId1: number;
  studentName1: string;
  studentEmail1: string;
  answerText1: string;
  attemptId2: number;
  studentName2: string;
  studentEmail2: string;
  answerText2: string;
  lexicalSimilarity: number;
  semanticSimilarity?: number | null;
  overallSimilarity: number;
  matchType: string;
  explanation?: string | null;
  aiAnalyzed: boolean;
}

export interface SimilarityReport {
  examId: number;
  examTitle: string;
  scannedAttemptsCount: number;
  scannedQuestionsCount: number;
  totalPairsCompared: number;
  flaggedPairsCount: number;
  aiEvaluated: boolean;
  aiMessage?: string | null;
  scannedAt: string;
  pairs: SimilarPair[];
}
