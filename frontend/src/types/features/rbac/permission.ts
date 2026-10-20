import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface PermissionDTO extends BaseDTO {
  name?: string;
  description?: string;
  resource?: string;
  action?: string;
}

export interface PermissionFilter extends BaseFilter {
  resource?: string;
  action?: string;
} 