/**
 * US-RES-001 — resources attached to a Project Template version.
 *
 * Resources are version-scoped: the Resources tab edits the draft version and
 * a published version keeps the list it was published with. Project copies are
 * created separately, so editing a template never changes an existing project.
 */
export type ResourceKind = "LINK" | "FILE";

export interface TemplateResourceFile {
  id: number;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  /** Relative API path (below `/api`) used to stream the file back. */
  downloadPath: string;
}

export interface TemplateResource {
  id: number;
  templateId: number;
  templateVersionId: number;
  title: string;
  description?: string | null;
  kind: ResourceKind;
  url?: string | null;
  category?: string | null;
  orderIndex: number;
  files: TemplateResourceFile[];
}

export interface TemplateResourceCollection {
  items: TemplateResource[];
  maxFileBytes: number;
  allowedExtensions: string[];
  editable: boolean;
}

export interface TemplateResourcePayload {
  title: string;
  description?: string | null;
  kind: ResourceKind;
  url?: string | null;
  category?: string | null;
  orderIndex?: number | null;
}
