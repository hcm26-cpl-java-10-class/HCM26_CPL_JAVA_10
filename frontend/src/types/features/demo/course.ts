import type { BaseDTO, BaseFilter } from "@/types/common/base";
import type { LessonContentType } from "./lesson";

export type CourseLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type CourseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface CourseDTO extends BaseDTO {
  name?: string;
  description?: string;
  thumbnailUrl?: string;
  instructor?: string;
  instructorId?: number;
  categoryIds?: number[];
  categoryNames?: string[];
  /** true = bỏ danh mục của khóa học khi cập nhật (backend bỏ qua categoryId = null). */
  clearCategory?: boolean;
  status?: CourseStatus;
  isFree?: boolean;
  level?: CourseLevel;
}

export interface CourseFilter extends BaseFilter {
  categoryId?: number;
  status?: CourseStatus;
  level?: CourseLevel;
}

export const COURSE_LEVEL_OPTIONS: { label: string; value: CourseLevel }[] = [
  { label: "Beginner", value: "BEGINNER" },
  { label: "Intermediate", value: "INTERMEDIATE" },
  { label: "Advanced", value: "ADVANCED" },
];

// ---------------------------------------------------------------------------
// Course catalog (GET /api/catalog/courses) — chỉ khóa PUBLISHED
// ---------------------------------------------------------------------------

export interface CatalogCourse {
  id: number;
  name: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  instructor?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  level?: CourseLevel | null;
  lessonCount: number;
  /** Tổng thời lượng, đơn vị giây (cùng đơn vị với Lesson.duration). */
  totalDuration: number;
  isFree: boolean;
  enrolled: boolean;
}

export type CatalogSort = "createdAt,desc" | "name,asc" | "name,desc";

export interface CatalogSearchParams {
  search?: string;
  categoryId?: number;
  level?: CourseLevel;
  /** 0-based */
  page?: number;
  size?: number;
  sort?: CatalogSort;
}

/** Spring `Page<T>` — dùng cho catalog vì API này trả thẳng Page, không qua base service. */
export interface CatalogPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  /** 0-based */
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  empty?: boolean;
}

// ---------------------------------------------------------------------------
// Course detail (GET /api/catalog/courses/{id})
// ---------------------------------------------------------------------------

export interface CourseDetailLesson {
  id: number;
  title: string;
  contentType: LessonContentType;
  duration?: number | null;
  orderIndex?: number | null;
  /** true khi user chưa ghi danh: contentUrl/textContent luôn null. */
  locked: boolean;
  contentUrl?: string | null;
  textContent?: string | null;
}

export interface CourseDetailSection {
  id: number;
  title: string;
  orderIndex?: number | null;
  lessons: CourseDetailLesson[];
}

export interface CourseDetail {
  id: number;
  name: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  instructor?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  level?: CourseLevel | null;
  isFree: boolean;
  enrolled: boolean;
  /** true nếu đã ghi danh, khóa miễn phí, là chủ khóa hoặc ADMIN. */
  contentUnlocked: boolean;
  lessonCount: number;
  totalDuration: number;
  sections: CourseDetailSection[];
  categoryNames?: string[] | null;
}