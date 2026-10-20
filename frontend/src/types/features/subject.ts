import type { BaseDTO, BaseFilter } from "@/types/common/base";

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
  technicalGroup?: string;
  version?: string;
}

export interface SubjectSummaryDTO {
  totalSubjects: number;
  activeSubjects: number;
  inactiveSubjects: number;
  countByTechnicalGroup: Record<string, number>;
}

