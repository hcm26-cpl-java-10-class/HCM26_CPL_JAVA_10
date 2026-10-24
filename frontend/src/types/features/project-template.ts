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
