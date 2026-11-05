/**
 * US-RES-004 — resources shared with a team workspace.
 * The payload never contains a raw storage path; documents are downloaded
 * through a short-lived signed URL.
 */
export type WorkspaceResourceKind = "FILE" | "LINK";

export interface WorkspaceResourceFile {
  id: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface WorkspaceResource {
  id: number;
  title: string;
  description?: string | null;
  kind: WorkspaceResourceKind;
  url?: string | null;
  category?: string | null;
  orderIndex: number;
  updatedAt?: string | null;
  updatedBy?: number | null;
  files: WorkspaceResourceFile[];
}

export interface WorkspaceResourceCollection {
  workspaceId: number;
  projectId?: number | null;
  teamId: number;
  total: number;
  /** US-RES-003 — true when the caller may add / edit / delete resources. */
  canManage: boolean;
  maxFileBytes: number;
  allowedExtensions: string[];
  items: WorkspaceResource[];
}

/** Payload of the create / update form (US-RES-003 AC01/AC02). */
export interface WorkspaceResourcePayload {
  title: string;
  description?: string | null;
  kind: WorkspaceResourceKind;
  url?: string | null;
  category?: string | null;
  orderIndex?: number | null;
}

export interface WorkspaceResourceDownloadTicket {
  url: string;
  fileName: string;
  expiresAt: string;
}
