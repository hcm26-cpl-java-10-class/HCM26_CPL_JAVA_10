import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface CategoryDTO extends BaseDTO {
  name?: string;
  code?: string;
  description?: string;
  /** null / undefined = root category */
  parentId?: number | null;
  parentName?: string;
}

export interface CategoryFilter extends BaseFilter {}

export interface CategoryTreeNode {
  id: number;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  parentId?: number | null;
  children: CategoryTreeNode[];
}