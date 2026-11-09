export type AiLanguage = "en" | "vi";

export type AiCourseLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface AiLessonOutline {
  title: string;
  summary: string;
  durationMinutes: number;
}

export interface AiSectionOutline {
  title: string;
  lessons: AiLessonOutline[];
}

export interface AiCourseOutline {
  name: string;
  description: string;
  level: AiCourseLevel;
  sections: AiSectionOutline[];
}

export interface AiCourseOption {
  label: string;
  rationale: string;
  course: AiCourseOutline;
}

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiChatResponse {
  reply: string;
  options: AiCourseOption[];
}

export interface AiApplyResult {
  courseId: number;
  courseName: string;
  sections: number;
  lessons: number;
}