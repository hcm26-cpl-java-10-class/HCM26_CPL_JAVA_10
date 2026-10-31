import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface CourseDTO extends BaseDTO {
  code?: string;
  subjectId?: number | null;
  name?: string;
  description?: string;
  thumbnailUrl?: string;
  instructor?: string;
}

export interface CourseFilter extends BaseFilter {
  subjectId?: number;
}
