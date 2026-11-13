export interface InheritedProjectResource {
  id: number;
  title: string;
  description?: string | null;
  version: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  kind?: "FILE" | "LINK" | null;
  url?: string | null;
}

export interface ProjectResourceGroup {
  projectId: number;
  projectCode: string;
  projectName: string;
  origin: "PARENT" | "SUB_PROJECT" | "PROJECT";
  resources: InheritedProjectResource[];
  sourceTemplateId?: number | null;
}

export interface WorkspaceProjectResources {
  workspaceId: number;
  teamId: number;
  projectId: number | null;
  capturedAt: string | null;
  groups: ProjectResourceGroup[];
}

export interface ProjectResourceDownloadLink {
  url: string;
  expiresAt: string;
}
