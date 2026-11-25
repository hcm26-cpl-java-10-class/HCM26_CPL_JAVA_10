import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface LocationUser {
  id: number;
  email?: string;
  fullName?: string;
  phone?: string;
  roleName?: string;
}

export interface LocationDTO extends BaseDTO {
  code?: string;
  name?: string;
  description?: string;
  parentLocationId?: number | null;
  parentLocationName?: string | null;
  path?: string;
  level?: number;
  status?: "ACTIVE" | "INACTIVE";
  totalUsers?: number;
  users?: LocationUser[];
}

export interface LocationPayload {
  code: string;
  name: string;
  description?: string;
  status?: "ACTIVE" | "INACTIVE";
  parentLocationId?: number | null;
}

export interface LocationFilter extends BaseFilter {
  parentLocationId?: number | null;
  status?: "ACTIVE" | "INACTIVE";
}

export interface LocationNode {
  id: number;
  code: string;
  name: string;
  description?: string;
  status?: "ACTIVE" | "INACTIVE";
  parentLocationId?: number | null;
  path?: string;
  level?: number;
  totalUsers?: number;
  users?: LocationUser[];
  children?: LocationNode[];
}

export type LocationAiSeverity = "HIGH" | "MEDIUM" | "LOW";

export interface LocationAiFinding {
  severity: LocationAiSeverity;
  title: string;
  description: string;
  locationId?: number | null;
  locationCode?: string | null;
  suggestedAction: string;
}

export interface LocationAiStatus {
  configured: boolean;
}

export interface LocationAiAnalysis {
  configured: boolean;
  aiUsed: boolean;
  summary: string;
  warning?: string | null;
  findings: LocationAiFinding[];
}

export interface LocationStaffCandidate {
  id: number;
  email: string;
  fullName: string;
  employeeCode?: string | null;
  roleName?: string | null;
}

export interface LocationImportPreviewRow {
  rowNumber: number;
  code: string;
  name: string;
  parentCode: string;
  status: "ACTIVE" | "INACTIVE";
  message: string;
  valid: boolean;
}

export interface LocationImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: LocationImportPreviewRow[];
}
