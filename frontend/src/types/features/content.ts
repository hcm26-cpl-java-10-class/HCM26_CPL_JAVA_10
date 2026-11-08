export type ProgramStatus = "ACTIVE" | "INACTIVE";

export interface TopicItem {
  id: number;
  code: string;
  name: string;
  version: string;
  technicalGroup?: string;
  durationHours: number;
  description?: string;
  isActive: boolean;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TopicFilter {
  search?: string;
  technicalGroup?: string;
  status?: string;
  active?: boolean;
}

export interface ProgramSubjectItem {
  id?: number;
  subjectId: number;
  code: string;
  name: string;
  version: string;
  durationHours: number;
  orderIndex: number;
}

export interface ProgramSubjectRequest {
  subjectId: number;
  orderIndex: number;
}

export interface TrainingProgramItem {
  id: number;
  code: string;
  name: string;
  version: string;
  region?: string;
  technicalGroup?: string;
  contentLink?: string;
  description?: string;
  status: ProgramStatus;
  isActive: boolean;
  totalDurationHours: number;
  subjects: ProgramSubjectItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface TrainingProgramRequest {
  code: string;
  name: string;
  version: string;
  region?: string;
  technicalGroup?: string;
  contentLink?: string;
  description?: string;
  status?: ProgramStatus;
  subjects: ProgramSubjectRequest[];
}

export interface ProgramImportPreviewRow {
  rowNumber: number;
  programCode: string;
  programName?: string;
  programVersion: string;
  region?: string;
  subjectCode: string;
  subjectVersion: string;
  orderIndex?: number;
  valid: boolean;
  errors: string[];
}

export interface ProgramImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  canImport: boolean;
  rows: ProgramImportPreviewRow[];
}

export interface TopicImportPreviewRow {
  rowNumber: number;
  code: string;
  name: string;
  version: string;
  technicalGroup?: string;
  durationHours?: number;
  description?: string;
  status?: string;
  valid: boolean;
  errors: string[];
}

export interface TopicImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  canImport: boolean;
  rows: TopicImportPreviewRow[];
}
