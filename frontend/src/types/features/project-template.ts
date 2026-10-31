import type { MilestoneRubricOption } from "./milestone";

/* ------------------------------------------------------------------------- */
/* Catalogue types (US-09)                                                    */
/* ------------------------------------------------------------------------- */

/**
 * Lifecycle status of a Project Template (US-09).
 * Only `ACTIVE` templates are browsable - `DRAFT` and `ARCHIVED` items are
 * hidden from the student catalogue.
 */
export type ProjectTemplateStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

/** Difficulty level used by the catalogue filter (AC01). */
export type ProjectTemplateLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

/** Team roles the template reserves seats for (AC02). */
export type ProjectRoleCode = "PM" | "BA" | "DEV" | "QA";

/** Seat quota of one role inside the project team. */
export interface ProjectTemplateRoleQuota {
  role: ProjectRoleCode;
  label: string;
  min: number;
  max: number;
}

/** One row of the grading rubric attached to a milestone. */
export interface ProjectTemplateRubricCriterion {
  criterion: string;
  /** Contribution to the milestone score, in percent. */
  weight: number;
}

/**
 * Relative milestone of the project brief.
 * `offsetWeeks` is measured from the project start date, so the milestone
 * dates are always relative to the team's actual kick-off.
 */
export interface ProjectTemplateMilestone {
  id: string;
  name: string;
  offsetWeeks: number;
  deliverable: string;
  /** Contribution to the final grade, in percent. */
  weight: number;
  rubric: ProjectTemplateRubricCriterion[];
}

/**
 * Project Template exposed by the "Project" class / `project` table.
 * <p>
 * Column mapping: `project_id` -> `projectId`, `class_id` -> `classId`,
 * `snapshot_id` -> `snapshotId`, `start_date` -> `startDate`,
 * `end_date` -> `endDate`, `created_at` -> `createdAt`,
 * `updated_at` -> `updatedAt`.
 * <p>
 * The catalogue fields (`domain`, `level`, `durationWeeks`, quotas and
 * milestones) come from the template snapshot payload, which is why this page
 * can be powered by frontend mock data until the backend module lands.
 */
export interface ProjectTemplate {
  projectId: string;
  classId: string;
  snapshotId: string;
  name: string;
  code: string;
  description: string;
  domain: string;
  level: ProjectTemplateLevel;
  durationWeeks: number;
  minMembers: number;
  maxMembers: number;
  roleQuotas: ProjectTemplateRoleQuota[];
  milestones: ProjectTemplateMilestone[];
  technologies: string[];
  startDate: string;
  endDate: string;
  status: ProjectTemplateStatus;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------------- */
/* Management / DTO types (US-05, US-06)                                     */
/* ------------------------------------------------------------------------- */

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

export interface TemplateBacklogItem {
  id: number;
  title: string;
  description: string | null;
  suggestedRole: TemplateSuggestedRole | null;
  orderIndex: number;
}

export interface TemplateSampleContent {
  templateId: number;
  lockVersion: number;
  editable: boolean;
  backlogItems: TemplateBacklogItem[];
  roles: TemplateSuggestedRole[];
  maxItems: number;
  maxImportBytes: number;
}

export interface TemplateBacklogInput {
  id?: number | null;
  title: string;
  description: string;
  suggestedRole?: TemplateSuggestedRole | null;
}

export interface TemplateSampleContentPayload {
  lockVersion: number;
  backlogItems: TemplateBacklogInput[];
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
  /** Shared catalogue row (tenant_id is null): readable by every tenant, never editable. */
  readOnly: boolean;
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

export interface ProjectTemplateListItem extends ProjectTemplateDTO {
  rowId: string;
  versionId: number | null;
  versionLabel: string;
  latestVersion: boolean;
  templateStatus: ProjectTemplateStatus;
}

export interface TemplateVersionListResponse {
  template: ProjectTemplateDTO;
  versionId: number | null;
  versionLabel: string;
  latestVersion: boolean;
  templateStatus: ProjectTemplateStatus;
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
