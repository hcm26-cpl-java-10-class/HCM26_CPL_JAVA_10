import type { BaseDTO } from "@/types/common/base";

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
