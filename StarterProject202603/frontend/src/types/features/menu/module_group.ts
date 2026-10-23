import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface ModuleGroupDTO extends BaseDTO {
    name?: string;
    description?: string;
    displayOrder?: number;
}

export interface ModuleGroupFilter extends BaseFilter {
}
