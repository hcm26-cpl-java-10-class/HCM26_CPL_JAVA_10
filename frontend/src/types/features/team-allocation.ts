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

export interface UpdateDraftTeamRequest {
  teamName: string;
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
  memberIds: number[];
  members?: Array<{
    memberId: number;
    fullName: string;
  }>;
}

export interface TeamListResponse {
  status: string;
  allocationSessionId: number;
  teams: AllocationTeam[];
  warnings: DraftWarning[];
}

export interface DraftTeamInput {
  teamName: string;
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
}
