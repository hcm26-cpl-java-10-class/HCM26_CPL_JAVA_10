import type { BaseDTO, BaseFilter } from "@/types/common/base";

export type AssessmentType = "QUIZ" | "EXAM" | "ASSIGNMENT" | string;

export interface AssessmentDTO extends BaseDTO {
    courseId?: number;
    courseName?: string;
    name?: string;
    description?: string;
    type?: AssessmentType;
    timeLimit?: number;
    maxAttempt?: number;
    dueAt?: string;

}

export interface AssessmentFilter extends BaseFilter {
    courseId?: number;
    name?: string;
    type?: AssessmentType;
}
