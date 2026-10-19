import type { BaseDTO, BaseFilter } from "@/types/common/base";

export type SubjectStatus = "ACTIVE" | "INACTIVE" | "DRAFT";

export interface SubjectDTO extends BaseDTO {
  code: string;
  name: string;
  version?: string;
  description?: string;
  technicalGroup?: string;
  durationHours: number;
  status: SubjectStatus;
export interface SubjectDTO extends BaseDTO {
  code: string;
  name: string;
  version: string;
  description?: string;
  technicalGroup?: string;
  durationHours: number;
}

export interface SubjectFilter extends BaseFilter {
  code?: string;
  name?: string;
  version?: string;
  technicalGroup?: string;
  status?: SubjectStatus;
  technicalGroup?: string;
  version?: string;
}
