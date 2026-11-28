import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface DepartmentDTO extends BaseDTO {
  code?: string;
  name?: string;
  parentDepartmentId?: string | number | null;
  status?: string;
}

export interface DepartmentFilter extends BaseFilter {
  parentDepartmentId?: string | number;
}
