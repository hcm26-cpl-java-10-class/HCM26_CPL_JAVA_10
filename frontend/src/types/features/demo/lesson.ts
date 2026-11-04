import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface LessonDTO extends BaseDTO {
  title?: string;
  description?: string;
  videoUrl?: string;
  durationMinutes?: number;
  orderIndex?: number;
  courseId?: number | string;
  courseName?: string;
}

export interface LessonFilter extends BaseFilter {
  courseId?: number | string;
  title?: string;
}
