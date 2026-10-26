export type ProjectTemplateLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type ProjectTemplateStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface TemplateRoleQuotas {
  pm: number;
  ba: number;
  dev: number;
  qa: number;
}

export interface TemplateTeamConstraints {
  minMembers: number;
  maxMembers: number;
  roleQuotas: TemplateRoleQuotas;
  allowMultiRole: boolean;
}

export interface TemplateTeamConstraintsPayload extends TemplateTeamConstraints {
  lockVersion: number;
}

export interface ProjectTemplateDTO {
  id: number;
  code: string;
  name: string;
  description: string;
  category: string;
  level: ProjectTemplateLevel;
  estimatedDurationWeeks: number;
  templateVersion: number;
  status: ProjectTemplateStatus;
  lockVersion: number;
  teamConstraints: TemplateTeamConstraints | null;
  createdAt: string;
  updatedAt: string;
  editable: boolean;
}

export interface ProjectTemplatePayload {
  code: string;
  name: string;
  description: string;
  category: string;
  level: ProjectTemplateLevel;
  estimatedDurationWeeks: number;
  lockVersion?: number;
}

export interface ProjectTemplateFilter {
  status?: ProjectTemplateStatus;
  level?: ProjectTemplateLevel;
  category?: string;
}

export interface ProjectTemplateOptions {
  tenantId: number;
  tenantName: string;
  categories: string[];
  canCreate: boolean;
  canUpdate: boolean;
}
