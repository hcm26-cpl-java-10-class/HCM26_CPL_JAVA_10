import type { BaseDTO, BaseFilter } from "@/types/common/base";

/**
 * Lifecycle status of a template version (US-07).
 * Every version created from an existing one starts as `DRAFT`.
 */
export type ProjectTemplateVersionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

/**
 * Project Template Version (snapshot) as exposed by
 * `/api/project-template-versions`.
 * <p>
 * `templateId` is the raw owner identifier; `templateName` is resolved by the
 * backend from the `project_templates` row so the UI can render a readable
 * label instead of a raw id.
 */
export interface ProjectTemplateVersionDTO extends BaseDTO {
  templateId?: number;
  /** Name of the owning Project Template (read-only, resolved by the API). */
  templateName?: string | null;
  projectId?: number;
  /**
   * Id of the version this one was cloned from (`parent_template_id`), kept for
   * historical traceability only.
   */
  parentTemplateId?: number | null;
  /** Business version label (e.g. `v1.0`), unique per template. */
  version?: string;
  /** Lifecycle status; new versions default to `DRAFT`. */
  status?: ProjectTemplateVersionStatus;
  /** Snapshot payload, must be valid JSON. */
  contentJson?: string;
}

export interface ProjectTemplateVersionFilter extends BaseFilter {
  templateId?: number;
  projectId?: number;
  parentTemplateId?: number;
  version?: string;
  status?: ProjectTemplateVersionStatus;
}

/** Audit trail row of a snapshot. */
export interface ProjectTemplateVersionAuditLog {
  id: number;
  snapshotId?: number | null;
  templateId?: number | null;
  projectId?: number | null;
  action?: string | null;
  actorId?: number | null;
  actorEmail?: string | null;
  correlationId?: string | null;
  beforeState?: string | null;
  afterState?: string | null;
  createdAt?: string | null;
}
