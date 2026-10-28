import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface SubjectDTO extends BaseDTO {
  code: string;
  name: string;
  version: string;
  description?: string;
  technicalGroup?: string;
  durationHours: number;
  status?: "ACTIVE" | "INACTIVE";
  objectives?: string;
  skills?: string;
  deliveryMode?: "ONLINE" | "OFFLINE" | "HYBRID";
  outline?: string;
}

export interface SubjectFilter extends BaseFilter {
  code?: string;
  name?: string;
  technicalGroup?: string;
  version?: string;
  minHours?: number;
  maxHours?: number;
}

export interface SubjectUsage {
  programSubjects: number;
  teachingAssignments: number;
  sessions: number;
  studySessions: number;
  referenced: boolean;
}

export interface SubjectImportInputRow {
  rowNumber: number;
  values: Record<string, string>;
}

export interface SubjectImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: (SubjectImportInputRow & { data: SubjectDTO | null; errors: string[]; valid: boolean })[];
}
