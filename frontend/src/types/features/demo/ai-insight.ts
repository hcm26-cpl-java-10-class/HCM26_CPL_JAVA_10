export type AiSeverity = "HIGH" | "MEDIUM" | "LOW";

export interface AiQuestionSnippet {
  id: number;
  content: string;
  upvotes: number;
  answered: boolean;
}

export interface AiTopicInsight {
  topic: string;
  misunderstanding: string;
  suggestion: string;
  questionCount: number;
  unansweredCount: number;
  upvotes: number;
  questions: AiQuestionSnippet[];
}

export interface AiLessonInsight {
  lessonId: number;
  lessonTitle: string;
  sectionId: number;
  sectionTitle: string;
  contentType: string;
  severity: AiSeverity;
  questionCount: number;
  unansweredCount: number;
  upvotes: number;
  topics: AiTopicInsight[];
}

export interface AiCourseInsight {
  courseId: number;
  courseName: string;
  totalQuestions: number;
  lessonsAnalyzed: number;
  lessons: AiLessonInsight[];
  generatedAt: string | null;
  cached: boolean;
  note: string | null;
}

export interface AiSupplementResult {
  lessonId: number;
  text: string;
  saved: boolean;
}

export interface AiChartItem {
  label: string;
  value: number;
  /** Percent (0-100, one decimal) calculated by the system. */
  percent: number;
  detail: string | null;
  lessonId: number | null;
}

export interface AiChart {
  key: "ANSWER_STATUS" | "QUESTIONS_BY_LESSON" | "UNANSWERED_BY_LESSON" | "TOP_TOPICS" | string;
  type: "DONUT" | "BAR";
  title: string;
  subtitle: string | null;
  items: AiChartItem[];
}

export interface AiInsightChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiInsightChatResponse {
  reply: string;
  charts: AiChart[];
  /** Per-lesson "where students get stuck" report; only when the AI was asked for it. */
  report: AiCourseInsight | null;
  suggestions: string[];
}