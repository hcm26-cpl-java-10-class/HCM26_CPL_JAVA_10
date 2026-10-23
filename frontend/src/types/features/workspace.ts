import type { TeamCharter } from "./project-hub";

export interface WorkspaceCandidateItem {
  projectId?: number | null;
  projectName?: string;
  projectCode?: string;
  projectStatus?: string;

  teamId: number;
  teamName?: string;
  teamCode?: string;
  memberCount?: number;

  cohortId?: number;
  cohortName?: string;

  workspaceId?: number;
  workspaceStatus?: string;
  eligibleForWorkspace: boolean;
  ineligibleReason?: string;
}

export interface WorkspaceCreateRequest {
  projectId: number;
  teamId: number;
}

export interface WorkspaceProjectOption {
  projectId?: number | null;
  name: string;
  code: string;
  status: string;
  cohortName?: string;
}

export interface WorkspaceResponse {
  id?: number;
  projectId: number;
  teamId: number;
  tenantId?: number;
  code?: string;
  name?: string;
  status?: string;
  createdBy?: number;
  createdAt?: string;
  sections: string[];
}

export interface WorkspaceActivity {
  eventId: string;
  action: string;
  actorId: number;
  actorName: string;
  occurredAt: string;
  correlationId: string;
}

export interface WorkspaceMember {
  id: number;
  name: string;
  email: string;
}

export interface WorkspaceDetail extends WorkspaceResponse {
  id: number;
  projectCode: string;
  projectName: string;
  projectDescription?: string;
  projectStatus: string;
  teamCode: string;
  teamName: string;
  mentorName?: string;
  charter: TeamCharter;
  cohortId?: number;
  cohortName?: string;
  createdAt?: string;
  createdByName?: string;
  members: WorkspaceMember[];
  activities: WorkspaceActivity[];
}

