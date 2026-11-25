import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface RoleDTO extends BaseDTO {
  name?: string;
  description?: string;
  permissionIds?: string[];
  isSystem?: boolean;
  userCount?: number;
}

export interface RoleFilter extends BaseFilter {
  permissionIds?: string[];
}

export interface RolePermissionMatrixItem {
  id: number;
  name: string;
  description?: string;
  resource: string;
  action: string;
}
