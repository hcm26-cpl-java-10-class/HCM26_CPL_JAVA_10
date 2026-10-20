import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface UserDTO extends BaseDTO {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  departmentId?: number | null;
  departmentName?: string | null;
  clearDepartment?: boolean;
  roleIds?: number[];
}

export interface UserFilter extends BaseFilter {
  departmentId?: number;
  roleIds?: number[];
}