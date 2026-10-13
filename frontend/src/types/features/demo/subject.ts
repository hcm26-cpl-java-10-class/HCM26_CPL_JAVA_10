import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface SubjectDTO extends BaseDTO {
    code?: string;
    name?: string;
    credits?: number;
    description?: string;
}

export interface SubjectFilter extends BaseFilter {
    code?: string;
    name?: string;
    credits?: number;
    search?: string;
}
