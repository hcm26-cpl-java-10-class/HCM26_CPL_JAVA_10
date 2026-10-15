import type { BaseDTO, BaseFilter } from "@/types/common/base";

export type SessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface SessionCancelDTO {
    reason: string;
}

export interface SessionDTO extends BaseDTO {
    classId?: number;
    topicId?: number;
    trainerId?: number;
    title?: string;
    startTime?: string; // LocalDateTime từ Spring Boot serialize về dạng ISO-8601 string
    endTime?: string;
    location?: string;
    status?: SessionStatus;
    note?: string;
    cancelReason?: string;
}

export interface SessionFilter extends BaseFilter {
    classId?: number;
    topicId?: number;
    trainerId?: number;
    status?: SessionStatus;
    startTime?: string;
    endTime?: string;
    search?: string;
}