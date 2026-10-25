export interface ProjectTeamMember { id: number; name: string; email: string }

export interface TeamCharter {
  mission: string;
  definitionOfDone: string;
  primaryChannel: string;
  coreHours: string;
  conflictResolution: string;
}

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

export interface ManagedTeamMember {
  userId: number;
  userCode: string | null;
  displayName: string;
  projectRole: import("./workspace").ProjectRole;
  status: import("./workspace").ParticipationStatus;
}
export interface TeamMemberOption { userId: number; userCode: string | null; displayName: string }
export type TeamMembershipUpdate = Pick<ManagedTeamMember, "projectRole" | "status">;
