export type AllocationSessionStatus = "OPEN" | "PUBLISHED" | "CLOSED" | "CANCELLED";
export type ProjectTeamStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface AllocationSession {
  id: number;
  classId: number;
  projectTemplateId: number | null;
  maxMembers: number;
  status: AllocationSessionStatus;
  version: number;
}

export interface MentorOption {
  mentorId: number;
  fullName: string;
  defaultMentor: boolean;
}

export interface UpdateDraftTeamRequest {
  teamName: string;
  assignedMentorId: number | null;
  members: Array<{
    memberId: number;
    role: string | null;
  }>;
}

export interface ClassMember {
  memberId: number;
  fullName: string;
}

export interface ClassRosterMember extends ClassMember {
  assignedToActiveTeam: boolean;
}

export interface DraftWarning {
  code: string;
  memberId: number;
  memberName: string;
  conflictingTeamIds: number[];
  conflictingTeamNames: string[];
  message: string;
}

export interface AllocationTeam {
  teamId: number;
  teamName: string;
  status: ProjectTeamStatus;
  version: number;
  assignedMentorId: number | null;
  assignedMentorName: string | null;
  memberIds: number[];
  members?: Array<{
    memberId: number;
    fullName: string;
    role: string | null;
  }>;
}

export type TeamMemberRole = "PM" | "BA" | "DEV" | "QA";

export interface UpdateTeamRolesRequest {
  expectedVersion: number;
  members: Array<{
    memberId: number;
    role: TeamMemberRole;
  }>;
}

export interface TransferTeamMemberRequest {
  destinationTeamId: number;
  sourceTeamVersion: number;
  destinationTeamVersion: number;
  reason: string;
}

export interface TeamMemberHistoryItem {
  id: number;
  classId: number;
  cohortId: number | null;
  allocationSessionId: number;
  memberId: number;
  memberName: string;
  fromTeamId: number | null;
  fromTeamName: string | null;
  toTeamId: number | null;
  toTeamName: string | null;
  fromRole: string | null;
  toRole: string | null;
  action: "ROLE_CHANGED" | "MEMBER_TRANSFERRED" | "MEMBER_SWAPPED" | "MEMBER_ADDED" | "MEMBER_REMOVED" | string;
  reason: string | null;
  actorId: number;
  actorName: string;
  occurredAt: string;
}

export interface TeamMemberHistoryPage {
  items: TeamMemberHistoryItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface TeamListResponse {
  status: string;
  allocationSessionId: number;
  teams: AllocationTeam[];
  warnings: DraftWarning[];
}

export interface DraftTeamInput {
  teamName: string;
  assignedMentorId: number | null;
  members: Array<{
    memberId: number;
    role: string | null;
  }>;
}

export interface SaveDraftRequest {
  teams: DraftTeamInput[];
}

export interface PublishTeamsResponse {
  allocationSessionId: number;
  succeededItems: number[];
  failedItems: Array<{
    teamId: number;
    errorCode: string;
    message: string;
    memberId: number | null;
    conflictingTeamId: number | null;
  }>;
}

export interface AllocationApiError {
  status?: number;
  errorCode?: string;
  message?: string;
  error?: string;
  memberId?: number | null;
  conflictingTeamId?: number | null;
  unassignedCount?: number;
  unassignedMemberIds?: number[];
  invalidMemberIds?: number[];
}
