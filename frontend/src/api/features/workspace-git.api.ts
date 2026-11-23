import api from "@/api/axios";

export interface WorkspaceGitConfig {
  workspaceId: number;
  configured: boolean;
  repositoryUrl: string | null;
  repositoryWebUrl: string | null;
  provider: string | null;
  defaultBranch: string | null;
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  canEdit: boolean;
  canUnlink: boolean;
}
export interface WorkspaceGitInput {
  version: number;
  repositoryUrl: string;
  defaultBranch: string;
  repositoryWebUrl?: string;
}

export interface GitActivityStatus {
  rootProjectId: number;
  connected: boolean;
  repositoryName: string | null;
  repositoryUrl: string | null;
  status: "ACTIVE" | "DISCONNECTED" | "ERROR" | "INACTIVE" | null;
  syncStatus: "NOT_SYNCED" | "SYNCING" | "READY" | "PARTIAL" | "ERROR" | null;
  lastSyncedAt: string | null;
  mockData: boolean;
}

export interface GitActivityFilterOptions {
  projects: Array<{ id: number; name: string }>;
  developers: Array<{ id: number; name: string; login: string }>;
}

export type GitPullRequestState = "OPEN" | "CLOSED" | "MERGED";
export type GitPullRequestReviewState = "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED";

export interface GitPullRequestReview {
  id: number;
  externalId: number;
  reviewerName: string;
  reviewerLogin: string | null;
  state: GitPullRequestReviewState;
  submittedAt: string;
  selfReview: boolean;
}

export interface GitPullRequestItem {
  id: number;
  number: number;
  title: string;
  authorName: string;
  authorLogin: string | null;
  state: GitPullRequestState;
  draft: boolean;
  createdAt: string;
  mergedAt: string | null;
  htmlUrl: string | null;
  tasks: GitTaskLink[];
}

export interface GitPullRequestDetails extends GitPullRequestItem {
  body: string | null;
  sourceBranch: string;
  targetBranch: string;
  closedAt: string | null;
  repositoryName: string;
  reviews: GitPullRequestReview[];
}

export interface GitTaskLink {
  taskId: number;
  projectId: number;
  title: string;
  source: "AUTO" | "MANUAL";
}

export interface GitTaskContext {
  taskId: number;
  projectId: number;
  projectName: string | null;
  title: string;
  status: string | null;
}

export interface GitCommitItem {
  id: number;
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  authorLogin: string | null;
  committedAt: string;
  branch: string | null;
  htmlUrl: string | null;
  tasks: GitTaskLink[];
}

export interface GitCommitDetails extends Omit<GitCommitItem, "shortSha"> {
  repositoryName: string;
  repositoryUrl: string;
}

export interface GitCommitQuery {
  search?: string;
  sort?: "newest" | "oldest";
  page?: number;
  size?: number;
  projectId?: number;
  taskId?: number;
  developerId?: number;
  contributorId?: number;
  branch?: string;
  unmappedOnly?: boolean;
  includeBots?: boolean;
  includeMergeCommits?: boolean;
  from?: string;
  to?: string;
}

export type GitCommitGranularity = "day" | "week" | "month";

export interface GitCommitAnalytics {
  totalCommits: number;
  granularity: GitCommitGranularity;
  trend: Array<{ key: string; label: string; startDate: string; endDate: string; commits: number }>;
  developers: Array<{
    developerId: number | null;
    contributorId: number | null;
    name: string;
    login: string | null;
    unmapped: boolean;
    bot: boolean;
    commits: number;
  }>;
  branches: Array<{ branch: string | null; label: string; commits: number }>;
  branchOptions: string[];
  unmappedContributorCommits: number;
}

export interface GitPullRequestAnalytics {
  total: number;
  open: number;
  merged: number;
  closedWithoutMerge: number;
  averageMergeHours: number | null;
  medianMergeHours: number | null;
  developers: Array<{
    developerId: number | null;
    contributorId: number | null;
    name: string;
    login: string | null;
    unmapped: boolean;
    total: number;
    open: number;
    merged: number;
    closedWithoutMerge: number;
  }>;
}

export interface GitCodeReviewAnalytics {
  totalReviews: number;
  approved: number;
  changesRequested: number;
  commented: number;
  reviewedPullRequests: number;
  averageFirstResponseHours: number | null;
  medianFirstResponseHours: number | null;
  reviewers: Array<{
    developerId: number | null;
    contributorId: number;
    name: string;
    login: string | null;
    reviews: number;
    approved: number;
    changesRequested: number;
    commented: number;
    pullRequests: Array<{
      id: number;
      number: number;
      title: string;
      state: string;
      createdAt: string;
      firstReviewAt: string | null;
      responseHours: number | null;
      htmlUrl: string | null;
    }>;
  }>;
}

export interface GitDeveloperActivityRow {
  developerId: number | null;
  contributorId: number | null;
  name: string;
  login: string | null;
  unmapped: boolean;
  noActivity: boolean;
  commits: number;
  pullRequests: number;
  mergedPullRequests: number;
  activeDays: number;
  lastActiveAt: string | null;
}

export interface GitDeveloperActivity {
  developers: GitDeveloperActivityRow[];
  totalCommits: number;
  totalPullRequests: number;
  mergedPullRequests: number;
}

export interface GitReportOptions {
  projects: Array<{ id: number; name: string }>;
  sprints: Array<{ id: number; projectId: number; name: string; startDate: string | null; endDate: string | null }>;
  developers: Array<{ id: number; name: string; login: string | null }>;
}

export interface GitActivitySummary {
  totalCommits: number;
  totalPullRequests: number;
  mergedPullRequests: number;
  openPullRequests: number;
  closedWithoutMergePullRequests: number;
}

export interface GitTaskTraceability {
  tasksWithCommits: number;
  tasksWithPullRequests: number;
  tasksWithoutGitActivity: number;
  unmappedCommits: number;
  unmappedPullRequests: number;
}

export interface GitSprintDevelopmentReport {
  sprintOverview: {
    sprintId: number;
    name: string;
    startDate: string | null;
    endDate: string | null;
    totalTasks: number;
    todoTasks: number;
    inProgressTasks: number;
    reviewTasks: number;
    doneTasks: number;
    unfinishedTasks: number;
  };
  gitActivity: GitActivitySummary;
  taskTraceability: GitTaskTraceability;
  developerActivity: GitDeveloperActivityRow[];
  repositoryConfigured: boolean;
  mockData: boolean;
}

export interface GitProjectDevelopmentReport {
  rootProjectId: number;
  projectId: number | null;
  projectName: string | null;
  repositoryName: string | null;
  repositoryUrl: string | null;
  repositoryConfigured: boolean;
  mockData: boolean;
  totalTasks: number;
  todoTasks: number;
  inProgressTasks: number;
  reviewTasks: number;
  doneTasks: number;
  gitActivity: GitActivitySummary;
  taskTraceability: GitTaskTraceability;
  developerActivity: GitDeveloperActivityRow[];
}

export type GitDevelopmentRuleType = "CONVENTIONAL_COMMIT" | "TASK_ID";
export interface GitDevelopmentRule {
  type: GitDevelopmentRuleType;
  enabled: boolean;
  version: number;
  allowedCommitTypes: string[];
  scopeRequired: boolean;
  taskKeyPattern: string;
  defaultTaskKeyPattern: string;
  taskKeyExample: string;
  canManage: boolean;
  updatedAt: string | null;
}
export type GitCommitValidationStatus = "PASSED" | "FAILED" | "MISSING" | "INVALID" | "OUTSIDE_PROJECT" | "NOT_EVALUATED";
export interface GitComplianceReport {
  evaluatedCommits: number;
  byRule: Record<GitDevelopmentRuleType, {
    evaluated: number; passed: number; failed: number; missing: number; invalid: number; outsideProject: number;
  }>;
  results: ApiPage<{
    commitId: number; sha: string; message: string; developerName: string; developerId: number | null;
    committedAt: string; ruleType: GitDevelopmentRuleType; ruleVersion: number; status: GitCommitValidationStatus;
    reason: string; details: string | null; evaluatedAt: string;
  }>;
  violationCount: number;
}

export type GitUnmappedActivityType = "COMMIT" | "PULL_REQUEST" | "ALL";
export interface GitUnmappedActivity {
  type: Exclude<GitUnmappedActivityType, "ALL">;
  id: number;
  number: number | null;
  sha: string | null;
  title: string;
  authorName: string;
  authorLogin: string | null;
  state: string | null;
  reason: string;
  occurredAt: string;
  htmlUrl: string | null;
}
export interface GitUnmappedActivitiesPage {
  activities: ApiPage<GitUnmappedActivity>;
  canManage: boolean;
}
export interface GitUnmappedTaskOption {
  id: number;
  projectId: number;
  projectName: string | null;
  title: string;
}

export interface ApiPage<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export const workspaceGitApi = {
  get: async (id: number, signal?: AbortSignal) =>
    (await api.get<WorkspaceGitConfig>(`/workspaces/${id}/git-config`, { signal })).data,
  save: async (id: number, input: WorkspaceGitInput) =>
    (await api.put<WorkspaceGitConfig>(`/workspaces/${id}/git-config`, input)).data,
  unlink: async (id: number, version: number) =>
    (await api.delete<WorkspaceGitConfig>(`/workspaces/${id}/git-config`, { params: { version } })).data,
  activityStatus: async (id: number, signal?: AbortSignal) =>
    (await api.get<GitActivityStatus>(`/workspaces/${id}/git-activity/status`, { signal })).data,
  taskContext: async (id: number, taskId: number, signal?: AbortSignal) =>
    (await api.get<GitTaskContext>(`/workspaces/${id}/git-activity/tasks/${taskId}`, { signal })).data,
  activityFilters: async (id: number, projectId?: number, signal?: AbortSignal) =>
    (await api.get<GitActivityFilterOptions>(`/workspaces/${id}/git-activity/filters`, {
      params: { projectId }, signal,
    })).data,
  commits: async (id: number, query: GitCommitQuery, signal?: AbortSignal) =>
    (await api.get<ApiPage<GitCommitItem>>(`/workspaces/${id}/git-activity/commits`, { params: query, signal })).data,
  commitAnalytics: async (id: number, query: GitCommitQuery & {
    granularity?: GitCommitGranularity;
    includeBots?: boolean;
    includeMergeCommits?: boolean;
  }, signal?: AbortSignal) =>
    (await api.get<GitCommitAnalytics>(`/workspaces/${id}/git-activity/analytics/commits`, {
      params: query, signal,
    })).data,
  pullRequestAnalytics: async (id: number, query: Pick<GitCommitQuery, "projectId" | "taskId" | "developerId" | "from" | "to">,
    signal?: AbortSignal) =>
    (await api.get<GitPullRequestAnalytics>(`/workspaces/${id}/git-activity/analytics/pull-requests`, {
      params: query, signal,
    })).data,
  codeReviewAnalytics: async (id: number, query: Pick<GitCommitQuery, "projectId" | "developerId" | "from" | "to">,
    signal?: AbortSignal) =>
    (await api.get<GitCodeReviewAnalytics>(`/workspaces/${id}/git-activity/analytics/reviews`, {
      params: query, signal,
    })).data,
  developerActivity: async (id: number, query: Pick<GitCommitQuery, "projectId" | "developerId" | "from" | "to">,
    signal?: AbortSignal) =>
    (await api.get<GitDeveloperActivity>(`/workspaces/${id}/git-activity/analytics/developers`, {
      params: query, signal,
    })).data,
  reportOptions: async (id: number, projectId?: number, signal?: AbortSignal) =>
    (await api.get<GitReportOptions>(`/workspaces/${id}/git-activity/reports/options`, {
      params: { projectId }, signal,
    })).data,
  sprintDevelopmentReport: async (id: number, sprintId: number, signal?: AbortSignal) =>
    (await api.get<GitSprintDevelopmentReport>(`/workspaces/${id}/git-activity/reports/sprints/${sprintId}`, { signal })).data,
  projectDevelopmentReport: async (id: number, query: Pick<GitCommitQuery, "projectId" | "developerId" | "from" | "to"> & { sprintId?: number },
    signal?: AbortSignal) =>
    (await api.get<GitProjectDevelopmentReport>(`/workspaces/${id}/git-activity/reports/project`, {
      params: query, signal,
    })).data,
  exportProjectDevelopmentReport: async (id: number, query: Pick<GitCommitQuery, "projectId" | "developerId" | "from" | "to"> & {
    sprintId?: number; format: "PDF" | "EXCEL";
  }) => api.get<Blob>(`/workspaces/${id}/git-activity/reports/export/project`, {
    params: query, responseType: "blob",
  }),
  exportSprintDevelopmentReport: async (id: number, sprintId: number, format: "PDF" | "EXCEL") =>
    api.get<Blob>(`/workspaces/${id}/git-activity/reports/export/sprints/${sprintId}`, {
      params: { format }, responseType: "blob",
    }),
  developmentRules: async (id: number, signal?: AbortSignal) =>
    (await api.get<GitDevelopmentRule[]>(`/workspaces/${id}/git-activity/rules`, { signal })).data,
  saveDevelopmentRule: async (id: number, rule: Pick<GitDevelopmentRule,
    "type" | "enabled" | "allowedCommitTypes" | "scopeRequired" | "taskKeyPattern">) =>
    (await api.put<GitDevelopmentRule>(`/workspaces/${id}/git-activity/rules`, rule)).data,
  validateAvailableGitCommits: async (id: number) =>
    (await api.post<Array<{ id: number; commitId: number; type: GitDevelopmentRuleType; ruleVersion: number;
      status: string; reason: string; details: string; evaluatedAt: string }>>(
      `/workspaces/${id}/git-activity/rules/validate`)).data,
  complianceReport: async (id: number, query: {
    developerId?: number; ruleType?: GitDevelopmentRuleType; status?: GitCommitValidationStatus;
    from?: string; to?: string; search?: string; failedOnly?: boolean; page?: number; size?: number;
  }, signal?: AbortSignal) =>
    (await api.get<GitComplianceReport>(`/workspaces/${id}/git-activity/rules/compliance`, { params: query, signal })).data,
  unmappedActivities: async (id: number, query: {
    type?: GitUnmappedActivityType; from?: string; to?: string; search?: string; page?: number; size?: number;
  }, signal?: AbortSignal) =>
    (await api.get<GitUnmappedActivitiesPage>(`/workspaces/${id}/git-activity/unmapped`, { params: query, signal })).data,
  unmappedTaskOptions: async (id: number, projectId?: number, search?: string, signal?: AbortSignal) =>
    (await api.get<{ tasks: GitUnmappedTaskOption[] }>(`/workspaces/${id}/git-activity/unmapped/tasks`, {
      params: { projectId, search }, signal,
    })).data,
  linkUnmappedActivity: async (id: number, input: {
    type: Exclude<GitUnmappedActivityType, "ALL">; activityId: number; taskId: number;
  }) => (await api.post(`/workspaces/${id}/git-activity/unmapped/links`, input)).data,
  pullRequests: async (id: number, query: GitCommitQuery, signal?: AbortSignal) =>
    (await api.get<ApiPage<GitPullRequestItem>>(`/workspaces/${id}/git-activity/pull-requests`, { params: query, signal })).data,
  pullRequest: async (id: number, pullRequestId: number, signal?: AbortSignal) =>
    (await api.get<GitPullRequestDetails>(`/workspaces/${id}/git-activity/pull-requests/${pullRequestId}`, { signal })).data,
  commit: async (id: number, commitId: number, signal?: AbortSignal) =>
    (await api.get<GitCommitDetails>(`/workspaces/${id}/git-activity/commits/${commitId}`, { signal })).data,
};
