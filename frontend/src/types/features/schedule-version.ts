import type { BaseDTO, BaseFilter } from "@/types/common/base";

export type ScheduleVersionStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface ScheduleVersionDTO extends BaseDTO {
    classId?: string;
    versionNumber?: number;
    status?: ScheduleVersionStatus;
    note?: string;
    clonedFromVersionId?: string;
    totalSessions?: number;
    activatedAt?: string;
    activatedBy?: string;
    previousActiveVersionId?: string;
    isEditable?: boolean;
    editableMessage?: string;
}

export interface ScheduleVersionFilter extends BaseFilter {
    classId?: string;
    status?: ScheduleVersionStatus;
    search?: string;
}

export interface CreateDraftRequest {
    note?: string;
}

export interface CloneVersionRequest {
    note?: string;
}
