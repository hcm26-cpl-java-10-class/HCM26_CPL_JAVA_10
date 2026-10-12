import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface UserDTO extends BaseDTO {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  roleIds?: string[];
}

export interface UserFilter extends BaseFilter {
  roleIds?: string[];
}