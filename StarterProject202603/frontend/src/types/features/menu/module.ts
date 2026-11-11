import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface ModuleDTO extends BaseDTO {
    moduleGroupId?: string;
    title?: string;
    url?: string;
    icon?: string;
    description?: string;
    displayOrder?: number;
    requiredPermission?: string;
}

export interface ModuleFilter extends BaseFilter {
    moduleGroupId?: string;
    title?: string;
}
