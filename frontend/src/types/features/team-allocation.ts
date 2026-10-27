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
    /** US-11: canonical role list (multi-role templates). */
    roles?: TeamMemberRole[];
  }>;
  /** US-10: project template currently assigned to this team. */
  projectTemplateId?: number | null;
  projectTemplateName?: string | null;
  minMembers?: number | null;
  maxMembers?: number | null;
  memberCount?: number | null;
  /** US-11: role policy of the assigned template. */
  allowMultiRole?: boolean;
  roleQuotas?: TeamRoleQuota[];
}

/** US-11: seat quota of one team role. */
export interface TeamRoleQuota {
  role: TeamMemberRole;
  min: number;
  max: number;
}

/** US-11: one quota problem returned in the 422 body. */
export interface TeamRoleQuotaViolation {
  role: TeamMemberRole | string;
  reason: "MISSING_REQUIRED_ROLE" | "ROLE_QUOTA_EXCEEDED" | string;
  required: number;
  actual: number;
}

/** US-10: pickable project template with its capacity window. */
export interface ProjectTemplateOption {
  id: number;
  code: string | null;
  name: string;
  minMembers: number;
  maxMembers: number;
  /** US-11 role policy. */
  allowMultiRole: boolean;
  roleQuotas: TeamRoleQuota[];
}

/** US-10/US-11: project template state of a team (mentor + student leader views). */
export interface TeamProjectTemplate {
  teamId: number;
  teamName: string;
  teamStatus: ProjectTeamStatus;
  /** US-11: optimistic-lock version used when saving roles. */
  version: number;
  classId: number | null;
  className: string | null;
  projectTemplateId: number | null;
  projectTemplateName: string | null;
  minMembers: number | null;
  maxMembers: number | null;
  memberCount: number;
  allowMultiRole: boolean;
  roleQuotas: TeamRoleQuota[];
  members: Array<{
    memberId: number;
    fullName: string;
    roles: TeamMemberRole[];
  }>;
}

/** US-10: error body of `ERR_TEAM_CAPACITY_EXCEEDED` / `ERR_TEAM_NOT_DRAFT`. */
export interface TeamTemplateApiError {
  status?: number;
  errorCode?: string;
  reason?: "MIN_MEMBERS_NOT_MET" | "MAX_MEMBERS_EXCEEDED" | string | null;
  message?: string;
  teamId?: number | null;
  projectTemplateId?: number | null;
  projectTemplateName?: string | null;
  memberCount?: number | null;
  minMembers?: number | null;
  maxMembers?: number | null;
}

export type TeamMemberRole = "PM" | "BA" | "DEV" | "QA";

export interface UpdateTeamRolesRequest {
  expectedVersion: number;
  members: Array<{
    memberId: number;
    /** Preferred US-11 field: supports multi-role templates. */
    roles: TeamMemberRole[];
    /** Backward compatible single-role field. */
    role?: TeamMemberRole | null;
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

/** US-12: a student without a team in the session. */
export interface ReadinessUnassignedStudent {
  memberId: number;
  fullName: string;
}

/** US-12: one team-level publish blocker. */
export interface TeamReadinessIssue {
  teamId: number;
  teamName: string;
  code: string;
  message: string;
  memberIds: number[];
  violations: TeamRoleQuotaViolation[];
}

/** US-12: strict-mode readiness report of a whole class/session. */
export interface AllocationReadiness {
  allocationSessionId: number;
  classId: number;
  sessionStatus: AllocationSessionStatus;
  readyToPublish: boolean;
  totalStudents: number;
  assignedStudents: number;
  unassignedStudentCount: number;
  unassignedStudents: ReadinessUnassignedStudent[];
  totalTeams: number;
  draftTeamCount: number;
  activeTeamCount: number;
  teamsWithTemplate: number;
  teamIssues: TeamReadinessIssue[];
  blockers: string[];
  checkedAt: string;
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
  /** US-12: free students with names so the banner can highlight them. */
  unassignedMembers?: ReadinessUnassignedStudent[];
  /** US-12: per-team publish blockers. */
  teamIssues?: TeamReadinessIssue[];
  blockers?: string[];
  invalidMemberIds?: number[];
  /** US-11: per-role quota violations. */
  violations?: TeamRoleQuotaViolation[];
  /** US-11: members holding more than one role on a single-role template. */
  multiRoleMemberIds?: number[];
}
