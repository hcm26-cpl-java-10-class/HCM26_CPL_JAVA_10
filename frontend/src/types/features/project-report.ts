export type ReportStatus = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "DONE" | "CANCELLED";
export type ReportRisk = "ALL" | "OVERDUE" | "AT_RISK" | "NEEDS_ATTENTION" | "LATE_SUBMISSION";
export interface ReportFilters {
  programId?: number; cohortId?: number; classId?: number; mentorId?: number; templateId?: number;
  sourceVersionId?: number; teamId?: number; projectId?: number; status?: ReportStatus; risk?: ReportRisk;
  includeCancelled?: boolean; createdFrom?: string; createdTo?: string; q?: string; page?: number; size?: number;
}
export interface ReportOption { id: number; name: string }
export interface ReportOptions {
  programs: ReportOption[]; cohorts: ReportOption[]; classes: (ReportOption & { programId: number | null; cohortId: number | null })[];
  mentors: ReportOption[]; templates: ReportOption[]; versions: (ReportOption & { templateId: number | null })[];
  teams: (ReportOption & { classId: number })[]; canExport: boolean; timeZone: string; atRiskHours: number; atRiskThreshold: number;
}
export interface ReportMilestone {
  id: string; title: string; status: string; mandatory: boolean; deadline: string | null; weight: number | null;
  progress: number; doneTasks: number; totalTasks: number; latestSubmittedAt: string | null;
  overdue: boolean; lateSubmission: boolean; atRisk: boolean;
}
export interface ReportProject {
  id: number; code: string; name: string; masterKey: string; classId: number; className: string;
  cohortId: number | null; cohortName: string | null; programId: number | null; programName: string | null;
  teamId: number; teamName: string; mentorId: number | null; mentorName: string | null;
  templateId: number | null; templateName: string; sourceVersionId: number | null; sourceVersion: string;
  workspaceId: number | null; status: ReportStatus; progress: number | null; weightingMode: string; notes: string[];
  acceptedMilestones: number; milestones: ReportMilestone[]; overdueMilestones: number; lateMilestones: number;
  atRiskMilestones: number; createdAt: string | null;
}
export interface ReportMaster {
  key: string; classId: number; className: string; templateId: number | null; templateName: string;
  sourceVersionId: number | null; sourceVersion: string; status: ReportStatus; progress: number | null;
  scopedTeams: number; matchingTeams: number; missingProgressTeams: number; projects: ReportProject[];
}
export interface ReportDashboard {
  summary: { masters: number; runningMasters: number; classes: number; cohorts: number; teams: number; projects: number;
    completionRate: number | null; averageProgress: number | null; overdueProjects: number; atRiskProjects: number;
    lateProjects: number; missingProgressProjects: number };
  statuses: Record<ReportStatus, number>; content: ReportMaster[]; total: number; page: number; size: number;
  asOf: string; timeZone: string; atRiskHours: number; atRiskThreshold: number;
}
export interface ReportExport {
  id: string; status: "QUEUED" | "RUNNING" | "READY" | "FAILED" | "EXPIRED"; format: "EXCEL" | "CSV";
  fileName: string | null; createdAt: string; generatedAt: string | null; expiresAt: string | null;
  rowCount: number | null; message: string | null;
}
