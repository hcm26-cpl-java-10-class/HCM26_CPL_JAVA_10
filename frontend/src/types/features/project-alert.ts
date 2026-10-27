export type AlertKind = "BACKLOG" | "MILESTONE" | "INACTIVE";
export interface AlertTeam {
  id: number; code: string; name: string; classId: number; classCode: string; className: string;
  programId: number | null; programName: string | null; cohortId: number | null; cohortName: string | null;
  projectId: number | null; projectName: string | null; projectStatus: string | null;
}
export interface AlertClass { id: number; code: string; name: string; programId: number | null; programName: string | null;
  cohortId: number | null; cohortName: string | null; studentCount: number; teamCount: number }
export interface AlertOptions { teams: AlertTeam[]; classes?: AlertClass[]; permissions: Record<string, boolean>; timeZone: string; inactiveHours: number; cooldownSeconds: number }
export interface AlertFilters { programId?: number; cohortId?: number; classId?: number; teamId?: number; teamSearch?: string;
  deadlineStatus: string; windowHours: number; page: number; size: number; inactiveOnly?: boolean }
export interface AlertPage { content: AlertRow[]; total: number; page: number; size: number; asOf: string; timeZone: string }
interface Row { id: string; team: AlertTeam; canSend: boolean }
export interface BacklogAlert extends Row { title: string; workType: string; status: string; deadline: string | null;
  deadlineStatus: string; version: number; assigneeUserId: number | null; assigneeName: string | null }
export interface MilestoneMemberProgress { userId:number; userCode:string|null; displayName:string; projectRole:string|null;
  assigned:number; done:number; percentage:number|null }
export interface MilestoneAlert extends Row { title: string; status: string; deadline: string; deadlineStatus: string; version: number; flagged: boolean;
  progress: { configured: boolean; done: number; total: number; percentage: number | null; source: string; atRisk: boolean }; canConfigure: boolean;
  mandatory: boolean; submission: { status: "SUBMITTED" | "NOT_SUBMITTED"; versionCount: number; latestVersion: number | null;
    submittedAt: string | null; submittedLate: boolean; acceptanceStatus: "NOT_AVAILABLE" }; alertReason?: "AT_RISK" | "OVERDUE" | "AWAITING_REVIEW" | "NONE";
  canViewMemberProgress?:boolean; memberProgress?:MilestoneMemberProgress[]|null; workWithoutCurrentStudent?:number|null }
export interface InactiveAlert extends Row { userCode: string | null; displayName: string; projectRole: string | null; joinedAt: string | null;
  lastContributionAt: string | null; activityStatus: string; inactive: boolean; lastReminderAt: string | null;
  nextReminderAt: string | null; coolingDown: boolean }
export type AlertRow = BacklogAlert | MilestoneAlert | InactiveAlert;
export interface AlertPayload { teamId: number; kind: AlertKind; selections: { id: string; version?: number }[]; warningNote: string }
export interface AlertResult { batchId: string; eventId: string; status: string; recipientCount: number; createdAt: string; correlationId: string }
export interface AlertHistory { batchId: string; kind: AlertKind; warningNote: string; recipientCount: number; status: string; createdAt: string; correlationId: string }
export interface MilestoneLinks { configured: boolean; milestoneVersion: number; selectedIds: number[]; availableItems: BacklogAlert[] }
export const alertRowName = (row: AlertRow) => "title" in row ? row.title : row.displayName;
export const alertRowKey = (row: AlertRow) => `${row.team.id}:${row.id}`;
