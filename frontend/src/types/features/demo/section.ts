
import type { BaseDTO } from "@/types/common/base";

export interface SectionDTO extends BaseDTO {
    courseId: number;
    title: string;
    orderIndex: number;
}

export interface SectionPayload {
    courseId: number;
    title: string;
    orderIndex: number;
    isActive?: boolean;
}
