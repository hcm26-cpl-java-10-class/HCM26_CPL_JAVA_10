export type QuestionType = "SINGLE_CHOICE" | "MULTI_CHOICE" | "ESSAY";
export type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD";

export interface QuestionOptionDTO {
  id?: number;
  content: string;
  correct: boolean;
}

export interface QuestionDTO {
  id: number;
  isActive: boolean;
  content: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  topic?: string | null;
  points: number;
  options: QuestionOptionDTO[];
}

export interface QuestionFilter {
  isActive?: boolean;
  type?: QuestionType;
  difficulty?: QuestionDifficulty;
  topic?: string;
}

export interface ExamDTO {
  id?: number;
  isActive?: boolean;
  title: string;
  durationMinutes: number;
  questionIds?: number[];
  questions?: QuestionDTO[];
  totalPoints?: number;
}

export interface ExamFilter {
  title?: string;
  isActive?: boolean;
}