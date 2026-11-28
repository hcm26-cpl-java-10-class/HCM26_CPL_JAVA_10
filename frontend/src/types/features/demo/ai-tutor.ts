export type AiTutorLanguage = "en" | "vi";

export interface AiTutorMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiTutorChatResponse {
  reply: string;
  /** false = the lesson has no written content, so the answer is not grounded in it. */
  lessonTextAvailable: boolean;
}

export interface AiTutorQuizQuestion {
  question: string;
  options: string[];
  /** 0-based index into options. */
  correctIndex: number;
  explanation: string;
}

export interface AiTutorQuizResponse {
  questions: AiTutorQuizQuestion[];
}
