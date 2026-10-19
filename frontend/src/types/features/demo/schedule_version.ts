import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface ScheduleVersionDTO extends BaseDTO {
  classId: number;
  versionNumber: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED" | string;
  note?: string;
  activatedAt?: string;
}

export interface ScheduleVersionFilter extends BaseFilter {
  classId?: number;
  status?: string;
}
