export type AlertKind = "BACKLOG" | "MILESTONE";
export interface AlertTeam {
  id: number; code: string; name: string; classId: number; classCode: string; className: string;
  programId: number | null; programName: string | null; cohortId: number | null; cohortName: string | null;
  projectId: number | null; projectName: string | null; projectStatus: string | null;
}
export interface AlertClass { id: number; code: string; name: string; programId: number | null; programName: string | null;
  cohortId: number | null; cohortName: string | null; studentCount: number; teamCount: number }
export interface AlertOptions { teams: AlertTeam[]; classes?: AlertClass[]; permissions: Record<string, boolean>; timeZone: string }
export interface AlertFilters { programId?: number; cohortId?: number; classId?: number; teamId?: number; teamSearch?: string;
  deadlineStatus: string; windowHours: number; page: number; size: number }
export interface AlertPage { content: AlertRow[]; total: number; page: number; size: number; asOf: string; timeZone: string }
interface Row { id: string; team: AlertTeam; canSend: boolean }
export interface BacklogAlert extends Row { title: string; workType: string; status: string; deadline: string | null;
  deadlineStatus: string; version: number; assigneeUserId: number | null; assigneeName: string | null }
export interface MilestoneAlert extends Row { title: string; status: string; deadline: string; deadlineStatus: string; version: number;
  progress: { configured: boolean; done: number; total: number; percentage: number; source: string; atRisk: boolean };
  mandatory: boolean; alertReason: "AT_RISK" | "NONE" }
export type AlertRow = BacklogAlert | MilestoneAlert;
export interface AlertPayload { teamId: number; kind: AlertKind; selections: { id: string; version?: number }[]; warningNote: string }
export interface AlertResult { batchId: string; eventId: string; status: string; recipientCount: number; createdAt: string; correlationId: string }
export interface AlertHistory { batchId: string; kind: AlertKind; warningNote: string; recipientCount: number; status: string; createdAt: string; correlationId: string }
export interface WorkspaceAlertItem { id: string | null; title: string | null; status: string | null; deadline: string | null;
  assigneeName: string | null; percentage: number | null; done: number | null; total: number | null }
export interface WorkspaceSentAlert { id: string; kind: AlertKind; warningNote: string; senderId: number; senderName: string;
  recipientCount: number; sentAt: string; status: "SENT"; items: WorkspaceAlertItem[] }
export interface WorkspaceAlertPage { workspaceId: number; teamId: number; content: WorkspaceSentAlert[]; total: number; page: number; size: number }
export const alertRowName = (row: AlertRow) => row.title;
export const alertRowKey = (row: AlertRow) => `${row.team.id}:${row.id}`;
