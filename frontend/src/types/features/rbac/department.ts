import type { BaseDTO, BaseFilter } from "@/types/common/base";

/** Khớp class Department trong class diagram (cây cha/con). */
export interface DepartmentDTO extends BaseDTO {
  code?: string;
  name?: string;
  description?: string;
  /** null/undefined = phòng ban gốc. Khi sửa (PUT) luôn được áp dụng. */
  parentDepartmentId?: string | number | null;
  /** Chỉ đọc. */
  parentDepartmentName?: string;
}

export interface DepartmentFilter extends BaseFilter {
  parentDepartmentId?: string | number;
}

/** Nút của GET /departments/tree. */
export interface DepartmentTreeNode {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  children: DepartmentTreeNode[];
}
