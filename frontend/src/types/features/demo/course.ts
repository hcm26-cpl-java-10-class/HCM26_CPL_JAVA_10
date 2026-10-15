import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface CourseDTO extends BaseDTO {
  name?: string;
  description?: string;
  thumbnailUrl?: string;
  instructor?: string;
  instructorId?: number;
}

export interface CourseFilter extends BaseFilter {}
