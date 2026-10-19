import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface CategoryDTO extends BaseDTO {
  name?: string;
  code?: string;
  description?: string;
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
  parentId?: number | null;
  children: CategoryTreeDTO[];
}