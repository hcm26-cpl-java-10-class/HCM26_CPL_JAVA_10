import type { QuestionDifficulty, QuestionType } from "./exam";
import type { CodeSpec } from "./exam";

export interface QuestionTypeRequestItem {
  type: QuestionType;
  count: number;
  difficulty: QuestionDifficulty;
  points: number;
}

export interface GenerateRequest {
  mode: "PROMPT" | "DOCUMENT";
  prompt?: string;
  documentContent?: string;
  courseId?: number;
  courseName?: string;
  examId?: number;
  examTitle?: string;
  topic?: string;
  language?: string;
  additionalInstructions?: string;
  requests: QuestionTypeRequestItem[];
}

export interface OptionItem {
  content: string;
  correct: boolean;
}

export interface GradingCriterionItem {
  name: string;
  description?: string;
  weightPercentage: number;
}

export interface GeneratedQuestion {
  tempId: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  content: string;
  points: number;
  topic?: string;
  explanation?: string;
  options?: OptionItem[];
  studentInstructions?: string;
  referenceAnswer?: string;
  rubric?: string;
  gradingCriteria?: GradingCriterionItem[];
  code?: CodeSpec | null;
}

export interface GenerateResponse {
  isFallback: boolean;
  provider: "GEMINI" | "FALLBACK";
  model: string;
  message: string;
  questions: GeneratedQuestion[];
}

export interface RegenerateSingleRequest {
  question: GeneratedQuestion;
  instruction?: string;
  topic?: string;
  language?: string;
}

export interface DocumentExtractResponse {
  fileName: string;
  fileSize: number;
  charCount: number;
  extractedText: string;
  status: string;
  message: string;
}

export interface AiGeneratorStatus {
  enabled: boolean;
  configured: boolean;
  provider: "GEMINI" | "FALLBACK";
  model: string;
  message: string;
}

export interface CommitToExamRequest {
  examId?: number;
  questions: GeneratedQuestion[];
}

export interface CommitToExamResponse {
  examId?: number;
  addedCount: number;
  questionIds: number[];
  message: string;
}
