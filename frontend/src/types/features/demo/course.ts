import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface CourseDTO extends BaseDTO {
  categoryName?: string;
  category?: string;
  courseLevel?: string;
  publicationStatus?: string;
  instructorEmail?: string;
  name?: string;
  description?: string;
  thumbnailUrl?: string;
  instructor?: string;
}

export interface CourseFilter extends BaseFilter {}
