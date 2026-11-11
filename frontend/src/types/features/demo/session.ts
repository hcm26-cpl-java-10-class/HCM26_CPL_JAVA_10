import type { BaseDTO, BaseFilter } from "@/types/common/base";

export type SessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface SessionCancelDTO {
    cancelReason: string;
}

export interface SessionRescheduleDTO {
    startTime: string;
    endTime: string;
    /** Omit to keep the current room. */
    location?: string;
}

export interface SessionDuplicateDTO {
    startTime: string;
    endTime: string;
    /** Omit to copy the room of the source session. */
    location?: string;
}

export interface SessionDTO extends BaseDTO {
    classId?: number;
    topicId?: number;
    trainerId?: number;
    teachingAssignmentId?: number;
    roomId?: number;
    meetingUrl?: string;
    title?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    status?: SessionStatus;
    note?: string;
    cancelReason?: string;
}

/** Mirrors the backend SessionFilter: every field is an exact/like/range filter on the server. */
export interface SessionFilter extends BaseFilter {
    classId?: number;
    topicId?: number;
    trainerId?: number;
    teachingAssignmentId?: number;
    roomId?: number;
    meetingUrl?: string;
    status?: SessionStatus;
    title?: string;
    location?: string;
    /** startTime >= fromDate (ISO local date-time) */
    fromDate?: string;
    /** endTime <= toDate (ISO local date-time) */
    toDate?: string;
}
