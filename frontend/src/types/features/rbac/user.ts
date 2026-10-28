import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface UserDTO extends BaseDTO {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  description?: string;
  /** user_roles (N-N): at least one role. */
  roleIds?: Array<string | number>;
  /** user_departments (N-N): optional. */
  departmentIds?: Array<string | number>;
}

export interface UserFilter extends BaseFilter {
  roleIds?: string[];
  departmentIds?: string[];
}
