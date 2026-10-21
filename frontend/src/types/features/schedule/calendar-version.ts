import type { BaseDTO } from "@/types/common/base";
import type { SessionDTO } from "./session";

export type CalendarVersionCreationMode = "EMPTY" | "COPY_ACTIVE";

export interface CreateCalendarVersionRequest {
    mode: CalendarVersionCreationMode;
    name: string;
    description: string | null;
}

export interface CalendarVersionResponse extends BaseDTO {
    calendarId: number;
    versionNumber: number;
    status: CalendarVersionStatus;
    activatedAt: string | null;
    activatedBy: number | null;
    name: string | null;
    description: string | null;
}

export interface UpdateCalendarVersionRequest {
    name?: string;
    description?: string | null;
}

export interface CalendarSummary {
    id: number;
    classId: number;
    name: string;
    description: string | null;
    activeVersionNumber: number | null;
}

export type CalendarVersionStatus = "DRAFT" | "ACTIVE" | "INACTIVE";

export interface CalendarVersionFilter {
    classId?: number;
    status?: CalendarVersionStatus;
    versionNumber?: number;
}

export interface SpringPage<T> {
    content: T[];
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
    first: boolean;
    last: boolean;
    numberOfElements: number;
}

export type CalendarConflictType =
    | "TRAINER_CONFLICT"
    | "ROOM_CONFLICT";

export type ConflictResolutionStatus =
    | "PENDING"
    | "ACKNOWLEDGED"
    | "APPROVED"
    | "REJECTED"
    | "REVOKED"
    | "APPLIED"
    | "STALE";

export type ConflictResolutionReason =
    | "SHARED_CLASS_SESSION"
    | "ROOM_PARTITIONED"
    | "ACKNOWLEDGED_PENDING_RESOLUTION";

export interface CalendarConflict {
    session: SessionDTO;
    conflictingSession: SessionDTO;
    conflictKey: string;
    conflictTypes: CalendarConflictType[];
    blockingConflictTypes: CalendarConflictType[];
    waivedConflictTypes: CalendarConflictType[];
    blocking: boolean;
    resolutionId: number | null;
    resolutionStatus: ConflictResolutionStatus | null;
    resolutionReason: ConflictResolutionReason | null;
}

export interface ConflictCheckResult {
    calendarVersionId: number;
    hasConflict: boolean;
    hasBlockingConflict: boolean;
    canActivate: boolean;
    conflictCount: number;
    blockingConflictCount: number;
    approvedOverrideCount: number;
    acknowledgedCount: number;
    conflicts: CalendarConflict[];
    validationErrors: Record<string, string[]>;
}

export interface CalendarActivationConflictError {
    status: 409;
    code: "CALENDAR_ACTIVATION_CONFLICT";
    message: string;
    conflictCheck: ConflictCheckResult;
    timestamp: string;
}

export interface ScheduleApiError {
    status: number;
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]> | null;
    timestamp?: string;
}
