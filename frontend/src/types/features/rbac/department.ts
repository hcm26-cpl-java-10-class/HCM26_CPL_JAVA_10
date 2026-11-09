import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface Department extends BaseDTO {
  code?: string;
  name?: string;
  parentDepartmentId?: string | number | null;
  status?: string;
}

/** Khớp class Department trong class diagram (cây cha/con). */
export type DepartmentDTO = Department;

export interface DepartmentFilter extends BaseFilter {
  parentDepartmentId?: string | number;
}
