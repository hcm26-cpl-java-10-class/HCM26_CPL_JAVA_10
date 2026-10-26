import type { ProjectRole, ParticipationStatus } from "@/types/features/workspace";

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  UNASSIGNED: "Unassigned role", TEAM_LEADER: "Team leader", DEV: "Developer",
  FE_DEV: "Frontend developer", BE_DEV: "Backend developer", BA: "Business analyst",
  QA: "Quality assurance", TESTER: "Tester"
};
export const PARTICIPATION_LABELS: Record<ParticipationStatus, string> = {
  ACTIVE: "Active", INACTIVE: "Inactive", LEFT: "Left"
};
