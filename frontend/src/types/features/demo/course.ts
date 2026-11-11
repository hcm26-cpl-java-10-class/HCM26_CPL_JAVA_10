
import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface CourseDTO extends BaseDTO {
  // Course information
  code?: string;
  name?: string;
  description?: string;
  thumbnailUrl?: string;

  // Subject information
  subjectId?: number | null;

  // Category information
  categoryName?: string;
  category?: string;

  // Course classification
  courseLevel?: string;
  publicationStatus?: string;

  // Instructor information
  instructor?: string;
  instructorEmail?: string;
}

export interface CourseFilter extends BaseFilter {
  subjectId?: number;
}
