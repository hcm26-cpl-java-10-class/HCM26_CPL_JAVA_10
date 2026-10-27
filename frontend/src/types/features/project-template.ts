import type { MilestoneRubricOption } from "./milestone";

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

export type TemplateMilestoneTimeUnit = "DAYS" | "WEEKS";

export interface TemplateMilestoneChecklistItem {
  id: number;
  content: string;
  mandatory: boolean;
  orderIndex: number;
}

export interface TemplateRubricCriterion {
  id: number;
  name: string;
  description: string | null;
  maxScore: number;
  orderIndex: number;
}

export interface TemplateLatePolicy {
  allowLateSubmission: boolean;
  maxLateDays: number | null;
  penaltyPerDayPercent: number | null;
}

export interface TemplateMilestone {
  id: number;
  title: string;
  description: string | null;
  dueAfter: number;
  dueUnit: TemplateMilestoneTimeUnit;
  weight: number;
  mandatory: boolean;
  orderIndex: number;
  checklistItems: TemplateMilestoneChecklistItem[];
  rubricVersionId: string | null;
  rubric: MilestoneRubricOption | null;
  legacyRubricCriteria: TemplateRubricCriterion[];
  latePolicy: TemplateLatePolicy | null;
}

export interface TemplateMilestonePlan {
  templateId: number;
  lockVersion: number;
  estimatedDurationWeeks: number | null;
  editable: boolean;
  milestones: TemplateMilestone[];
}

export interface TemplateMilestonePlanPayload {
  lockVersion: number;
  milestones: {
    id?: number;
    title: string;
    description: string;
    dueAfter: number;
    dueUnit: TemplateMilestoneTimeUnit;
    weight: number;
    mandatory: boolean;
    rubricVersionId: string;
    checklistItems: {
      id?: number;
      content: string;
      mandatory: boolean;
    }[];
    latePolicy: TemplateLatePolicy;
  }[];
}

export interface TemplateMilestoneOptions {
  rubrics: MilestoneRubricOption[];
}

export type TemplateSuggestedRole = "PM" | "BA" | "DEV" | "QA";
export type TemplateArtifactType = "FILE" | "URL";

export interface TemplateBacklogItem {
  id: number;
  title: string;
  description: string | null;
  suggestedRole: TemplateSuggestedRole;
  orderIndex: number;
}

export interface TemplateArtifactRequirement {
  id: number;
  milestoneId: number;
  title: string;
  description: string | null;
  type: TemplateArtifactType;
  allowedMimeTypes: string[];
  orderIndex: number;
}

export interface TemplateSampleContent {
  templateId: number;
  lockVersion: number;
  editable: boolean;
  backlogItems: TemplateBacklogItem[];
  artifacts: TemplateArtifactRequirement[];
  milestones: { id: number; title: string; orderIndex: number }[];
  roles: TemplateSuggestedRole[];
  supportedMimeTypes: string[];
  maxItems: number;
  maxImportBytes: number;
}

export interface TemplateBacklogInput {
  id?: number | null;
  title: string;
  description: string;
  suggestedRole: TemplateSuggestedRole;
}

export interface TemplateSampleContentPayload {
  lockVersion: number;
  backlogItems: TemplateBacklogInput[];
  artifacts: {
    id?: number;
    milestoneId: number;
    title: string;
    description: string;
    type: TemplateArtifactType;
    allowedMimeTypes: string[];
  }[];
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
  canActivate: boolean;
  canArchive: boolean;
}

export type TemplateConfigurationSection = "overview" | "team-constraints" | "milestones";

export interface TemplateActivationChecklist {
  templateId: number;
  lockVersion: number;
  status: ProjectTemplateStatus;
  ready: boolean;
  canActivate: boolean;
  items: {
    section: TemplateConfigurationSection;
    label: string;
    passed: boolean;
    errors: Record<string, string[]>;
  }[];
}
