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

  classId?: number;
  classCode?: string;
  className?: string;

  workspaceId?: number;
  workspaceStatus?: string;
  eligibleForWorkspace: boolean;
  ineligibleReason?: string;
}

export interface WorkspaceCreateRequest {
  projectId?: number | null;
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
  projectId?: number | null;
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

export type ProjectRole = "UNASSIGNED" | "TEAM_LEADER" | "DEV" | "FE_DEV" | "BE_DEV" | "BA" | "QA" | "TESTER";
export type ParticipationStatus = "ACTIVE" | "INACTIVE" | "LEFT";

export interface WorkspaceMember {
  user_code: string | null;
  display_name: string;
  project_role: ProjectRole;
  status: ParticipationStatus;
}

export interface WorkspaceTopicSnapshot {
  topic_code: string;
  topic_title: string;
  version: string;
  description: string | null;
  objectives: string | null;
  requirements: string[];
  attachments: { name: string; url: string }[];
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
  member_count: number;
  can_view_members: boolean;
  topic_snapshot: WorkspaceTopicSnapshot | null;
  activities: WorkspaceActivity[] | null;
}

export type WorkspaceSectionKey = "overview" | "members" | "milestones" | "sprints" | "backlog" | "artifacts" | "feedback" | "activity";
export interface WorkspaceSectionAccess { key: WorkspaceSectionKey; canRead: boolean; actions: Record<string, boolean> }
export interface WorkspaceNavigation {
  workspaceId: number; projectId?: number | null; teamId: number; projectCode?: string | null; projectName?: string | null;
  teamName: string; projectStatus?: string | null; sections: WorkspaceSectionAccess[];
}
export interface WorkspaceSectionItem {
  id: string; title: string; description: string | null; status: string; published: boolean; score?: number; occurredAt?: string;
}
export interface WorkspaceSectionContent {
  workspaceId: number; projectId?: number | null; teamId: number; section: WorkspaceSectionKey; items: WorkspaceSectionItem[];
}
export interface SectionCreate { title: string; description: string; published: boolean }
export interface SectionReview {
  kind: "ARTIFACT" | "MILESTONE" | "SPRINT"; targetId: string; comment: string; score?: number; published: boolean;
}
