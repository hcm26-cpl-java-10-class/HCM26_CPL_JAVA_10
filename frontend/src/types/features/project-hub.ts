export interface ProjectTeamMember { id: number; name: string; email: string; userCode: string | null }

export interface TeamCharter {
  mission: string;
  definitionOfDone: string;
  primaryChannel: string;
  coreHours: string;
  conflictResolution: string;
  /** Optimistic-lock token returned by the server, not a charter revision. */
  version?: number | null;
  responsibilities?: { membershipId: number; responsibility: string }[];
}

export interface TeamCharterView {
  teamId: number;
  teamName: string;
  teamStatus: "ACTIVE" | "ARCHIVED";
  revision: number;
  canEdit: boolean;
  charter: TeamCharter;
  rosterToken: string;
  members: CharterMember[];
  confirmedCount: number;
  memberCount: number;
  progress: "NOT_SAVED" | "NEEDS_REVIEW" | "PENDING" | "FULLY_CONFIRMED";
  canConfirm: boolean;
  confirmationBlockReason: string | null;
  /** Additive response fields; optional while an older backend is being deployed. */
  timeZone?: string;
  contentComplete?: boolean;
  /** ADMIN is a separate self-acknowledgement, not a team member's consent. */
  confirmationKind?: "MEMBER" | "ADMIN" | null;
  selfConfirmedAt?: string | null;
}

export interface CharterMember {
  membershipId: number; classMemberId: number; userId: number; name: string; email: string | null;
  roles: string[]; responsibility: string; eligible: boolean; issue: string | null;
  confirmed: boolean; confirmedAt: string | null;
}
export interface CharterHistory {
  revision: number;
  actorId?: number | null;
  savedAt?: string | null;
  charter?: { [K in keyof TeamCharter]?: TeamCharter[K] | null } | null;
  members?: CharterMember[] | null;
  confirmations?: {
    userId: number; name?: string | null; roles?: string[] | null;
    responsibility?: string | null; confirmedAt?: string | null;
  }[] | null;
}
export interface CharterHistoryPage { content: CharterHistory[] | null; totalElements: number; totalPages: number; number: number }

export interface ProjectTeam {
  id: number;
  code: string;
  name: string;
  projectId?: number | null;
  projectName?: string | null;
  cohortId?: number;
  cohortName?: string;
  mentorId?: number;
  mentorName?: string;
  members: ProjectTeamMember[];
  charter: TeamCharter;
}

export interface ProjectMentor { id: number; name: string; email: string }
