import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface RoleDTO extends BaseDTO {
  name?: string;
  description?: string;
  permissionIds?: string[];
}

export interface RoleFilter extends BaseFilter {
  permissionIds?: string[];
}
