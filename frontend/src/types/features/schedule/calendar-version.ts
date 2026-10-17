import type { BaseDTO } from "@/types/common/base";

export type CalendarVersionCreationMode = "EMPTY" | "COPY_ACTIVE";

export interface CreateCalendarVersionRequest {
    mode: CalendarVersionCreationMode;
}

export interface CalendarVersionResponse extends BaseDTO {
    calendarId: number;
    versionNumber: number;
    status: string;
    activatedAt: string | null;
    activatedBy: number | null;
}

export interface CalendarSummary {
    id: number;
    classId: number;
    name: string;
    description: string | null;
    activeVersionNumber: number | null;
}
