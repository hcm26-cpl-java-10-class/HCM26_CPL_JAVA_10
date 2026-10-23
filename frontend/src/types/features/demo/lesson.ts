import type { BaseDTO, BaseFilter } from "@/types/common/base";

export type LessonContentType = "VIDEO" | "AUDIO" | "TEXT" | "DOCUMENT" | "LINK";

export interface LessonDTO extends BaseDTO {
  sectionId?: number;
  title?: string;
  contentType?: LessonContentType;
  contentUrl?: string;
  textContent?: string;
  duration?: number;
  orderIndex?: number;
}

export interface LessonFilter extends Partial<BaseFilter> {
  sectionId?: number;
  contentType?: LessonContentType;
}

export const LESSON_CONTENT_TYPE_OPTIONS: { label: string; value: LessonContentType }[] = [
  { label: "Video (URL)", value: "VIDEO" },
  { label: "Audio (URL)", value: "AUDIO" },
  { label: "Text content", value: "TEXT" },
  { label: "Document (resource link)", value: "DOCUMENT" },
  { label: "Link (resource link)", value: "LINK" },
];
