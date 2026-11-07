export type ReportStatus = "DRAFT" | "PLANNING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type ReportRisk = "ALL" | "OVERDUE" | "INACTIVE_MEMBERS" | "NEEDS_ATTENTION" | "LATE_SUBMISSION";
export interface ReportFilters {
  programId?: number; cohortId?: number; classId?: number; mentorId?: number; templateId?: number;
  sourceVersionId?: number; teamId?: number; projectId?: number; status?: ReportStatus; masterStatus?: ReportStatus; risk?: ReportRisk;
  includeCancelled?: boolean; createdFrom?: string; createdTo?: string; q?: string; page?: number; size?: number;
}
export interface ReportOption { id: number; name: string }
export interface ReportOptions {
  programs: ReportOption[]; cohorts: ReportOption[]; classes: (ReportOption & { programId: number | null; cohortId: number | null })[];
  mentors: ReportOption[]; templates: ReportOption[]; versions: (ReportOption & { templateId: number | null })[];
  teams: (ReportOption & { classId: number })[]; canExport: boolean; timeZone: string; inactiveDays: number;
}
export interface BacklogCounts { total: number; todo: number; inProgress: number; review: number; done: number; other: number }
export interface ReportMilestone {
  id: string; title: string; status: string; mandatory: boolean; deadline: string | null;
  backlog: BacklogCounts; latestSubmittedAt: string | null; overdue: boolean; lateSubmission: boolean;
}
export interface ReportInactiveMember {
  userId: number; userCode: string | null; name: string; joinedAt: string | null;
  lastActivityAt: string | null; pendingSince: string | null;
}
export interface ReportProject {
  id: number; code: string; name: string; parentProjectId: number | null; depth: number;
  masterId: number; masterCode: string; masterName: string; masterKey: string; classId: number; className: string;
  cohortId: number | null; cohortName: string | null; programId: number | null; programName: string | null;
  teamId: number | null; teamName: string | null; mentorId: number | null; mentorName: string | null;
  templateId: number | null; templateName: string; sourceVersionId: number | null; sourceVersion: string;
  workspaceId: number | null; status: ReportStatus; masterStatus: ReportStatus; backlog: BacklogCounts;
  acceptedMilestones: number; milestones: ReportMilestone[]; overdueMilestones: number; lateMilestones: number;
  inactiveMembers: ReportInactiveMember[]; createdAt: string | null; contextOnly: boolean;
}
export interface ReportMaster {
  key: string; id: number; code: string; name: string; classId: number; className: string;
  templateId: number | null; templateName: string; sourceVersionId: number | null; sourceVersion: string;
  status: ReportStatus; backlog: BacklogCounts; scopedTeams: number; matchingTeams: number;
  subProjects: number; matchingSubProjects: number; project: ReportProject; projects: ReportProject[];
}
export interface ReportDashboard {
  summary: { masters: number; runningMasters: number; classes: number; cohorts: number; teams: number; subProjects: number;
    backlog: BacklogCounts; overdueProjects: number; inactiveProjects: number; inactiveMembers: number; lateProjects: number };
  statuses: Record<ReportStatus, number>; content: ReportMaster[]; total: number; page: number; size: number;
  asOf: string; timeZone: string; inactiveDays: number;
}
export interface ReportExport {
  id: string; status: "QUEUED" | "RUNNING" | "READY" | "FAILED" | "EXPIRED"; format: "EXCEL" | "CSV";
  fileName: string | null; createdAt: string; generatedAt: string | null; expiresAt: string | null;
  rowCount: number | null; message: string | null;
}
