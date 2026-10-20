import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface CategoryDTO extends BaseDTO {
  name?: string;
  code?: string;
  description?: string;
  iconUrl?: string;
  displayOrder?: number;
  parentId?: number | null;
  parentName?: string;
}

export interface CategoryFilter extends BaseFilter {
  name?: string;
  parentId?: number[];
  code?: string;
}

export interface CategoryTreeDTO {
  id: number;
  name: string;
  code: string;
  description?: string;
  isActive?: boolean;
  iconUrl?: string | null;
  displayOrder?: number;
  /** Số khóa PUBLISHED + active thuộc trực tiếp danh mục. */
  courseCount?: number;
  /** Như courseCount nhưng gồm cả danh mục con, cháu. */
  totalCourseCount?: number;
  parentId?: number | null;
  children: CategoryTreeDTO[];
}