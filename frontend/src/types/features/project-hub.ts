import type { WorkspaceMember } from "./workspace";

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
  members: WorkspaceMember[];
  charter: TeamCharter;
}

export interface ProjectMentor { id: number; name: string; email: string }
