import type { BaseDTO, BaseFilter } from "@/types/common/base";

/** Khớp class Department trong class diagram (cây cha/con). */
export interface DepartmentDTO extends BaseDTO {
  code?: string;
  name?: string;
  parentDepartmentId?: string | number | null;
  status?: string;
}

export interface DepartmentFilter extends BaseFilter {
  parentDepartmentId?: string | number;
}
