export type ReportStatus = "DRAFT" | "PLANNING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type ReportRisk = "ALL" | "OVERDUE" | "INACTIVE_MEMBERS" | "NEEDS_ATTENTION" | "LATE_SUBMISSION";
export interface ReportFilters {
  programId?: number; cohortId?: number; classId?: number; mentorId?: number; templateId?: number;
  sourceVersionId?: number; teamId?: number; projectId?: number; status?: ReportStatus; masterStatus?: ReportStatus; risk?: ReportRisk;
  includeCancelled?: boolean; createdFrom?: string; createdTo?: string; q?: string; page?: number; size?: number;
  masterId?: number; workSprintId?: number;
}
export interface ReportOption { id: number; name: string }
export interface ReportOptions {
  programs: ReportOption[]; cohorts: ReportOption[]; classes: (ReportOption & { programId: number | null; cohortId: number | null })[];
  mentors: ReportOption[]; templates: ReportOption[]; versions: (ReportOption & { templateId: number | null })[];
  teams: (ReportOption & { classId: number })[]; canExport: boolean; timeZone: string; inactiveDays: number;
  projects: (ReportOption & { masterId: number; classId: number; teamId: number | null })[];
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
  overview: {
    activeMasters: number; activeTeams: number;
    milestoneStatuses: Record<"PLANNED" | "IN_PROGRESS" | "SUBMITTED" | "ACCEPTED" | "CHANGES_REQUESTED" | "REJECTED" | "WAIVED", number>;
    artifactStatuses: Record<"DRAFT" | "SUBMITTED" | "ACCEPTED" | "CHANGES_REQUESTED" | "REJECTED", number>;
    overdueBacklogItems: number; overdueSubtasks: number; overdueTasks: number;
    milestoneRisks: number; inactiveMembers: number; riskCount: number;
  };
  work: { backlog: BacklogCounts; sprints: ReportSprint[]; selectedSprintId: number | null };
  deliveries: ReportDelivery[];
  risks: { key: string; kind: string; projectId: number | null; projectName: string; teamName: string | null; subject: string; deadline: string | null; reason: string }[];
  activities: ReportActivityPage;
}
export interface ReportSprint {
  id: number; name: string; status: string; projectId: number | null; projectCode: string | null; projectName: string;
  teamId: number | null; teamName: string | null; startAt: string | null; endAt: string | null; backlog: BacklogCounts;
}
export interface ReportDelivery {
  milestoneId: string; title: string; projectId: number; projectCode: string; projectName: string; masterId: number; masterName: string;
  teamId: number | null; teamName: string | null; mandatory: boolean; milestoneStatus: string; artifactStatus: string | null;
  submissionId: string | null; version: number | null; deadline: string | null; submittedAt: string | null;
  reviewerName: string | null; checklistCompleted: number; checklistTotal: number; attention: string;
}
export interface ReportActivity {
  id: string; occurredAt: string; projectId: number; projectCode: string; projectName: string; masterName: string;
  teamId: number | null; teamName: string | null; actorName: string; entityType: string; entityId: string;
  subject: string; action: string; beforeStatus: string | null; afterStatus: string | null; href: string | null;
}
export interface ReportActivityPage { content: ReportActivity[]; offset: number; limit: number; hasMore: boolean; asOf: string }
export interface ReportActivityHistory {
  content: ReportActivity[]; page: number; size: number; total: number; asOf: string; activityFrom: string; activityTo: string;
}
export interface ReportActivityHistoryFilters { activityFrom: string; activityTo: string; historyPage: number; historySize: number; before?: string }
export interface ReportExport {
  id: string; status: "QUEUED" | "RUNNING" | "READY" | "FAILED" | "EXPIRED"; format: "EXCEL";
  fileName: string | null; createdAt: string; generatedAt: string | null; expiresAt: string | null;
  rowCount: number | null; message: string | null;
}
