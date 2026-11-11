import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface SubjectDTO extends BaseDTO {
  subjectCode?: string;
  subjectName?: string;
  version?: string;
  technicalGroup?: string;
  durationHours?: number;
  status?: string;
  description?: string;
}

export interface SubjectFilter extends BaseFilter {
  subjectCode?: string;
  subjectName?: string;
  technicalGroup?: string;
  status?: string;
}