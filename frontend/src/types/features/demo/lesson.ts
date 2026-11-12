import type { BaseDTO, BaseFilter } from "@/types/common/base";

export type LessonContentType = "VIDEO" | "AUDIO" | "TEXT" | "DOCUMENT" | "LINK" | "QUIZ" | "EXAM" | "ASSIGNMENT";

export interface LessonDTO extends BaseDTO {
  sectionId?: number;
  title?: string;
  description?: string;
  videoUrl?: string;
  durationMinutes?: number;
  contentType?: LessonContentType;
  contentUrl?: string;
  textContent?: string;
  outlineEditable?: boolean;
  duration?: number;
  orderIndex?: number;
  courseId?: number | string;
  courseName?: string;
}

export interface LessonFilter extends Partial<BaseFilter> {
  courseId?: number | string;
  title?: string;
  sectionId?: number;
  contentType?: LessonContentType;
}

export const LESSON_CONTENT_TYPE_OPTIONS: { label: string; value: LessonContentType }[] = [
  { label: "Video (URL)", value: "VIDEO" },
  { label: "Audio (URL)", value: "AUDIO" },
  { label: "Text content", value: "TEXT" },
  { label: "Quiz", value: "QUIZ" },
  { label: "Exam", value: "EXAM" },
  { label: "Assignment", value: "ASSIGNMENT" },
  { label: "Document (resource link)", value: "DOCUMENT" },
  { label: "Link (resource link)", value: "LINK" },
];
