import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface RoleDTO extends BaseDTO {
  name?: string;
  description?: string;
  isSystem?: boolean;
  userCount?: number;
  permissionIds?: number[];
}

export interface RoleFilter extends BaseFilter {
  permissionIds?: number[];
}
