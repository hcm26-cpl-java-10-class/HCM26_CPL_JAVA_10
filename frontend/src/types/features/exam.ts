export type QuestionType = "MULTIPLE_CHOICE" | "ESSAY" | "CODING";

export const CODE_TYPES = [
  "int",
  "long",
  "double",
  "boolean",
  "char",
  "String",
  "int[]",
  "boolean[]",
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
  /** Time limit per test in seconds (1-10); null/undefined = default 5. */
  timeLimitSeconds?: number | null;
  /** true = teacher wrote the Main class; false = auto-generated. */
  customMain?: boolean;
  /** Main class (custom or auto-generated). Only saved when customMain is true. */
  mainCode?: string | null;
  /** Teacher's demo solution used to check the tests. Teacher-only; never sent to students. */
  referenceCode?: string | null;
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
  source?: string | null;
  isAiGenerated?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
}

export interface QuestionFilter {
  isActive?: boolean;
  type?: QuestionType;
  difficulty?: QuestionDifficulty;
  topic?: string;
}

export type LatePolicy = "NOT_ALLOWED" | "ALLOWED_WITH_PENALTY" | "ALLOWED";
export type ExamStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
export type IntegrityReviewStatus = "UNREVIEWED" | "CLEARED" | "CONFIRMED_VIOLATION";
export type ExamType = "MULTIPLE_CHOICE" | "ESSAY" | "CODING" | "MC_CODING" | "MIXED";
export type ExamCategory = "ASSIGNMENT" | "QUIZ" | "MIDTERM" | "FINAL_TEST";
export type ResultVisibility = "IMMEDIATE" | "AFTER_EXAM_CLOSED" | "MANUAL_RELEASE";

export const EXAM_CATEGORY_LABEL: Record<ExamCategory, string> = {
  ASSIGNMENT: "Assignment",
  QUIZ: "Quiz",
  MIDTERM: "Midterm",
  FINAL_TEST: "Final Test",
};

export const EXAM_CATEGORY_SHOW_ANSWERS_DEFAULT: Record<ExamCategory, boolean> = {
  ASSIGNMENT: true,
  QUIZ: true,
  MIDTERM: false,
  FINAL_TEST: false,
};

export interface ExamDTO {
  id?: number;
  isActive?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  /** Full name of the creator (empty for old data). */
  createdByName?: string | null;
  /** Submitted attempts waiting for the teacher to grade. */
  pendingGradingCount?: number;
  invitationCount?: number;
  hasAttempts?: boolean;
  title: string;
  durationMinutes: number;
  status?: ExamStatus;
  startTime?: string | null;
  endTime?: string | null;
  version?: number | null;
  maxAttempts?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  showAnswersAfterExam?: boolean;
  passScore?: number | null;
  courseWeight?: number | null;
  maxScore?: number | null;
  latePolicy?: LatePolicy;
  latePenaltyPercent?: number | null;
  lateGraceMinutes?: number;
  resultVisibility?: ResultVisibility;
  category?: ExamCategory;
  examType?: ExamType;
  allowedQuestionTypes?: QuestionType[];
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
  cameraProctoring?: boolean;
  notifyOnViolation?: boolean;
  headTurnAngleDeg?: number | null;
  headTurnSeconds?: number | null;
  fastSubmitPercent?: number | null;
  // Tu danh gia / danh gia cheo (UFR-EXM-012)
  selfReviewEnabled?: boolean;
  peerReviewEnabled?: boolean;
  peerReviewCount?: number | null;
  peerReviewAnonymous?: boolean;
  peerReviewShowReference?: boolean;
  // Optional link to a course / section / lesson (null = not linked)
  courseId?: number | null;
  sectionId?: number | null;
  lessonId?: number | null;
  courseName?: string | null;
  sectionTitle?: string | null;
  lessonTitle?: string | null;
}

export interface ExamFilter {
  title?: string;
  isActive?: boolean;
  category?: ExamCategory;
  courseId?: number;
  sectionId?: number;
  lessonId?: number;
}

/** One option of the course / section / lesson pickers in the exam form. */
export interface ExamLinkOption {
  id: number;
  title: string;
}

/** Compact exam info returned by GET /courses/{id}/exams (no questions or answers). */
export interface CourseExam {
  id: number;
  title: string;
  category: ExamCategory;
  examType: ExamType;
  durationMinutes: number;
  maxAttempts: number | null;
  courseWeight?: number | null;
  maxScore: number | null;
  passScore: number | null;
  isActive: boolean;
  courseId: number | null;
  sectionId: number | null;
  sectionTitle: string | null;
  lessonId: number | null;
  lessonTitle: string | null;
  /** Only returned to the course teacher and admin. */
  questionCount: number | null;
  createdByName: string | null;
  /** Student view: true while blocked by course or lesson progress. Staff always get false. */
  locked: boolean;
  lockReason: string | null;
}

export type EssayAttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "PENDING_REVIEW" | "EXPIRED";

export type AiEssayGradingState =
  | "PENDING"
  | "PROCESSING"
  | "AI_COMPLETED"
  | "FAILED"
  | "CONFIRMED"
  | "SKIPPED";

export type AiGradingBatchStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "PARTIAL_FAILED"
  | "FAILED";

export interface EssayGradingSummary {
  attemptId: number;
  examId?: number;
  examTitle?: string;
  studentId: number;
  studentName: string;
  studentEmail: string;
  attemptNumber: number;
  status: EssayAttemptStatus;
  submittedAt: string | null;
  essayCount: number;
  essayAnswered: number;
  aiGradedEssayCount?: number;
  codingCount?: number;
  codingAnswered?: number;
  aiGradingState?: AiEssayGradingState | null;
  aiProposedScore?: number | null;
  finalScore?: number | null;
  aiGradedAt?: string | null;
  aiGradingError?: string | null;
  confirmedBy?: number | null;
  confirmedAt?: string | null;
  maxEssayScore?: number | null;
  lowScoreFlagged?: boolean;
  lowScoreReason?: string | null;
}

export interface EssayGradingItem {
  questionId: number;
  displayOrder: number;
  content: string;
  points: number;
  maxScore?: number;
  answerText: string;
  /** Estimated % AI-written; null/undefined = too short to judge. */
  aiPercent?: number | null;
  aiLevel?: "LOW" | "MEDIUM" | "HIGH" | null;
  aiSignals?: string[] | null;
  score?: number | null;
  feedback?: string | null;
  referenceAnswer?: string | null;
  referenceSubmittedAt?: string | null;
  rubric?: string | null;
  rubricSubmittedAt?: string | null;
  gradingCriteria?: EssayGradingCriterion[];
  aiProposal?: AiQuestionProposal | null;
  aiGradedAt?: string | null;
  aiGradingStatus?: string | null;
  aiGradingError?: string | null;
}

export interface QuestionGuidelineDTO {
  examId: number;
  questionId: number;
  referenceAnswer?: string | null;
  referenceSubmittedAt?: string | null;
  rubric?: string | null;
  rubricSubmittedAt?: string | null;
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
  /** Bài đã được sửa điểm tay: không cho chấm lại coding tự động. */
  scoreAdjusted?: boolean;
  aiGradingState?: AiEssayGradingState | null;
  aiProposedEssayScore?: number | null;
  aiGradedAt?: string | null;
  aiGradingError?: string | null;
  confirmedBy?: number | null;
  confirmedAt?: string | null;
  maxEssayScore?: number | null;
  lowScoreFlagged?: boolean;
  lowScoreReason?: string | null;
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
  aiPercent?: number | null;
  aiLevel?: "LOW" | "MEDIUM" | "HIGH" | null;
  aiSignals?: string[] | null;
  score?: number | null;
  feedback?: string | null;
  spec?: CodeSpec | null;
  /** null = đã có điểm; PENDING = đang chấm nền; RETRYING = máy chấm lỗi, tự thử lại; FAILED = hết lượt, cần chấm tay. */
  autoGradeState?: "PENDING" | "RETRYING" | "FAILED" | null;
  /** Trạng thái từng test của lần chấm tự động đã lưu (theo thứ tự test). */
  testStatuses?: string[] | null;
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

export interface BatchAiPreviewDTO {
  examId: number;
  examTitle: string;
  totalSubmitted: number;
  eligibleCount: number;
  alreadyAiGradedCount: number;
  ungradedCount: number;
  failedCount: number;
  confirmedCount: number;
  ineligibleCount: number;
  lowScoreFlaggedCount?: number;
  autoConfirmableCount?: number;
  activeBatchId?: number | null;
  activeBatchStatus?: AiGradingBatchStatus | null;
  savedReferenceAnswer?: string | null;
  savedRubric?: string | null;
}

export type BatchAiScope = "UNGRADED_ONLY" | "FAILED_ONLY" | "ALL_ELIGIBLE";

export interface StartBatchAiRequest {
  scope?: BatchAiScope;
  attemptIds?: number[];
  forceRegrade?: boolean;
  referenceAnswer?: string;
  rubric?: string;
  autoGenerateGuidelines?: boolean;
}

export interface BulkConfirmAiRequest {
  confirmationText: string;
  attemptIds?: number[];
}

export interface BulkConfirmAiResultDTO {
  examId: number;
  confirmedCount: number;
  skippedLowScoreCount: number;
  skippedFailedCount: number;
  confirmedAttemptIds: number[];
  skippedLowScoreAttemptIds: number[];
  message: string;
}

export interface BatchAiItemDTO {
  itemId: number;
  attemptId: number;
  examId: number;
  studentId: number | null;
  studentName: string;
  status: AiEssayGradingState;
  retryCount: number;
  essayCount: number;
  aiGradedEssayCount: number;
  proposedTotalEssayScore?: number | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface BatchAiStatusDTO {
  batchId: number;
  examId: number;
  examTitle: string;
  triggeredByUserId?: number | null;
  scope: BatchAiScope;
  status: AiGradingBatchStatus;
  totalAttempts: number;
  pendingCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
  progressPercent: number;
  notificationSent: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
  lastError?: string | null;
  items?: BatchAiItemDTO[];
}

export interface AiReviewQueuePage {
  content: EssayGradingSummary[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}
