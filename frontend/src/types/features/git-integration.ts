/**
 * GI-01: GitHub App installations of the current organization (tenant).
 * Installations belong to a GitHub account or organization, not to a project.
 * Mirrors the backend DTOs.
 */

export type GitIntegrationSummaryStatus = "CONNECTED" | "NOT_CONNECTED" | "SUSPENDED";

export type GitInstallationStatus = "CONNECTED" | "SUSPENDED" | "DISCONNECTED";

export type GitOAuthOutcome =
  | "CONNECTED"
  | "RECONNECTED"
  | "PENDING_APPROVAL"
  | "DENIED"
  | "INVALID_CALLBACK"
  | "INSTALLATION_NOT_OWNED"
  | "LINKED_ELSEWHERE"
  | "PROVIDER_ERROR";

export interface GitInstallation {
  id: number;
  installationId: number;
  status: GitInstallationStatus;
  accountLogin: string;
  accountType: "User" | "Organization" | string;
  repositorySelection?: "all" | "selected" | string | null;
  githubUserLogin?: string | null;
  connectedByUserId: number;
  connectedByName?: string | null;
  connectedAt: string;
  lastVerifiedAt: string;
}

export interface GitInstallationListResponse {
  status: GitIntegrationSummaryStatus;
  canManage: boolean;
  installations: GitInstallation[];
}

export interface GitHubConnectStartResponse {
  installUrl: string;
  expiresAt: string;
}

/** Query parameters GitHub appended to the callback URL, forwarded unchanged. */
export interface GitHubCallbackRequest {
  state: string;
  code?: string;
  installationId?: number;
  setupAction?: string;
  error?: string;
  errorDescription?: string;
}

export interface GitHubCallbackResponse {
  outcome: GitOAuthOutcome;
  message: string;
  installation: GitInstallation | null;
}

/** Stable error codes returned in `code` by every Git Integration endpoint. */
export type GitIntegrationErrorCode =
  | "GIT_INTEGRATION_DISABLED"
  | "GIT_INTEGRATION_FORBIDDEN"
  | "GIT_STATE_INVALID"
  | "GIT_AUTHORIZATION_DENIED"
  | "GIT_CALLBACK_INVALID"
  | "GIT_INSTALLATION_NOT_OWNED"
  | "GIT_INSTALLATION_LINKED_ELSEWHERE"
  | "GIT_PROVIDER_UNAVAILABLE"
  | "GIT_INSTALLATION_NOT_FOUND"
  | "GIT_INSTALLATION_NOT_ACTIVE"
  | "GIT_RATE_LIMITED"
  | "GIT_PROJECT_NOT_FOUND"
  | "GIT_PROJECT_NOT_MASTER"
  | "GIT_PROJECT_NOT_LINKABLE"
  | "GIT_PROJECT_ALREADY_LINKED"
  | "GIT_REPOSITORY_IN_USE"
  | "GIT_REPOSITORY_NOT_ACCESSIBLE"
  | "GIT_REPOSITORY_ARCHIVED"
  | "GIT_REPOSITORY_NOT_LINKED"
  | "GIT_REQUEST_INVALID"
  | "GIT_PULL_REQUEST_NOT_FOUND"
  | "GIT_WEBHOOK_EVENT_NOT_FOUND"
  | "GIT_WEBHOOK_EVENT_NOT_REPLAYABLE"
  | "GIT_WEBHOOK_PAYLOAD_PURGED"
  | "GIT_BACKLOG_ITEM_NOT_FOUND"
  | "GIT_TASK_LINK_NOT_FOUND"
  | "GIT_TASK_OUTSIDE_PROJECT"
  | "GIT_TASK_INACTIVE"
  | "GIT_TASK_LINK_TYPE_NOT_SUPPORTED"
  | "GIT_TASK_LINK_SOURCE_INVALID"
  | "UNAUTHENTICATED";

export interface GitIntegrationErrorBody {
  status: number;
  code: GitIntegrationErrorCode | string;
  message: string;
  correlationId?: string;
  /** GIT_RATE_LIMITED */
  retryAfterSeconds?: number;
  /** GIT_INSTALLATION_NOT_ACTIVE */
  installationStatus?: GitInstallationStatus;
  /** GI-04: context for link errors. */
  details?: {
    /** GIT_PROJECT_ALREADY_LINKED */
    repository?: { externalId: number; fullName: string; htmlUrl: string; defaultBranch?: string | null };
    /** GIT_REPOSITORY_IN_USE (absent when the project belongs to another organization) */
    linkedProject?: GitProjectSummary;
    /** GIT_PROJECT_NOT_MASTER */
    masterProject?: GitProjectSummary;
    /** GIT_PROJECT_NOT_LINKABLE */
    projectStatus?: string;
  };
  /** GIT_REQUEST_INVALID: field-keyed messages. */
  errors?: Record<string, string>;
}

export interface GitProjectSummary {
  id: number;
  code?: string | null;
  name?: string | null;
}

// ---- US-GI-03 · Browse repositories --------------------------------------------------------------

export type GitRepositoryFilter = "all" | "available" | "linked";

export type GitRepositoryUnavailableReason =
  | "LINKED_TO_OTHER_PROJECT"
  | "LINKED_TO_THIS_PROJECT"
  | "ARCHIVED"
  | "DISABLED";

export interface GitRepositoryItem {
  externalId: number;
  name: string;
  owner: string;
  fullName: string;
  htmlUrl: string;
  visibility: "public" | "private" | "internal" | string;
  defaultBranch?: string | null;
  archived: boolean;
  /** Project the repository is actively linked to; code/name are null outside your organization. */
  linkedProject: { id: number; code?: string | null; name?: string | null } | null;
  selectable: boolean;
  unavailableReason: GitRepositoryUnavailableReason | null;
}

export interface GitRepositoryPage {
  installation: { id: number; accountLogin: string; accountType: string; status: GitInstallationStatus };
  items: GitRepositoryItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  counts: { all: number; available: number; linked: number };
  fetchedAt: string;
  fromCache: boolean;
  truncated: boolean;
}

export interface GitRepositoryQuery {
  q?: string;
  filter?: GitRepositoryFilter;
  page?: number;
  size?: number;
  refresh?: boolean;
  projectId?: number;
}

// ---- US-GI-04 · Link a repository to a master project ---------------------------------------------

export type GitRepositoryConnectionStatus = "ACTIVE" | "INACTIVE" | "UNAVAILABLE";

export type GitSyncJobType = "INITIAL" | "MANUAL" | "SCHEDULED" | "WEBHOOK";

export type GitSyncJobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export interface GitSyncJob {
  id: number;
  type: GitSyncJobType;
  status: GitSyncJobStatus;
  attemptCount: number;
  maxAttempts: number;
  nextRunAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  errorCode?: string | null;
  stats: { branches?: number; branchesTruncated?: boolean; [key: string]: unknown };
}

export interface LinkedRepository {
  id: number;
  externalId: number;
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  visibility: "public" | "private" | "internal" | string;
  defaultBranch?: string | null;
  status: GitRepositoryConnectionStatus;
  installation: { id: number; accountLogin: string; accountType: string; status: GitInstallationStatus } | null;
  linkedBy: { id: number; name?: string | null } | null;
  linkedAt: string;
  lastSyncedAt?: string | null;
}

/** Repository of a project; a module shows its master project's repository (`inherited`). */
export interface ProjectRepositoryView {
  project: { id: number; code: string; name: string; master: boolean };
  masterProject: { id: number; code: string; name: string; status: string; moduleCount: number };
  inherited: boolean;
  repository: LinkedRepository | null;
  latestSync: GitSyncJob | null;
  canLink: boolean;
  canSync: boolean;
}

export interface LinkRepositoryRequest {
  /** `git_installations.id` (internal id) */
  installationId: number;
  /** GitHub's numeric repository id */
  externalId: number;
}

// ---- US-SY-04 · Data synchronized from GitHub webhooks --------------------------------------------

export interface GitPage<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface GitCommitItem {
  id: number;
  sha: string;
  shortSha: string;
  /** First line of the message. */
  headline: string;
  message: string;
  authorName?: string | null;
  /** GitHub login; null when the commit e-mail is not linked to a GitHub account. */
  authorLogin?: string | null;
  committedAt: string;
  htmlUrl?: string | null;
  /** Branch of the first push that brought the commit (refs/heads/ removed). */
  branch?: string | null;
  filesChanged?: number | null;
  /** US-SY-05: a merge commit (several parents). */
  merge: boolean;
  /** US-SY-05: Task IDs mentioned by the message and their verdict. */
  taskRefs: GitTaskRef[];
}

// ---- US-SY-05: commits / pull requests linked to tasks ------------------------------------------

/** `EXCLUDED` (US-TM-03): a valid Task ID whose pull request a user unlinked from the task. */
export type GitTaskRefStatus = "LINKED" | "INVALID" | "OUTSIDE_PROJECT" | "MISSING" | "EXCLUDED";
export type GitTaskRefReason = "OK" | "NOT_FOUND" | "DELETED" | "OTHER_PROJECT" | "NO_TASK_ID" | "UNLINKED_BY_USER";
/**
 * `BRANCH` only on old pull request rows: since US-TM-03 a pull request is read from its title and description.
 * `MERGED_PR`: a merge / squash commit takes the tasks of the pull request it merged (`rawText` is `#number`).
 */
export type GitTaskRefField = "MESSAGE" | "TITLE" | "BRANCH" | "BODY" | "MERGED_PR" | "NONE";
/** US-TM-03: AUTO follows the Task IDs of the text; MANUAL is made or pinned by a user and never removed automatically. */
export type GitLinkSource = "AUTO" | "MANUAL";

/**
 * A Task ID found in a commit or pull request. `key` is null for MISSING; title only for LINKED.
 * `source` is how it is linked (null when not linked); a MANUAL link the text does not name has `field` NONE.
 */
export interface GitTaskRef {
  key: string | null;
  rawText?: string | null;
  status: GitTaskRefStatus;
  reason: GitTaskRefReason;
  field: GitTaskRefField;
  itemId?: number | null;
  itemTitle?: string | null;
  itemStatus?: string | null;
  source?: GitLinkSource | null;
}

/** `NEEDS_ATTENTION` = no Task ID, an unknown one or one of another project. */
export type GitTaskLinkFilter = "LINKED" | "NEEDS_ATTENTION" | "MISSING" | "INVALID" | "OUTSIDE_PROJECT";

/** Task Detail: commits (paged, newest first) and pull requests linked to a task. */
export interface BacklogGitLinks {
  itemId: number;
  taskKey: string | null;
  repository: { id: number; fullName: string; htmlUrl: string; status: GitRepositoryConnectionStatus } | null;
  pullRequests: LinkedPullRequest[];
  commits: GitPage<GitCommitItem>;
  commitCount: number;
  pullRequestCount: number;
}

/** US-TM-03: why a pull request is on a task. `field` (TITLE / BODY) only for AUTO. */
export interface BacklogGitLinkInfo {
  id: number;
  source: GitLinkSource;
  field?: GitTaskRefField | null;
  linkedByUserId?: number | null;
  linkedByName?: string | null;
  linkedAt: string;
}

export interface LinkedPullRequest {
  pullRequest: GitPullRequestItem;
  link: BacklogGitLinkInfo;
}

/** US-TM-03 link picker row. `linkedTaskKeys`: other tasks the pull request is on (up to 3). */
export interface GitPullRequestCandidate {
  id: number;
  number: number;
  title: string;
  state: GitPullRequestState;
  draft: boolean;
  authorLogin?: string | null;
  updatedAt?: string | null;
  alreadyLinked: boolean;
  linkedTaskKeys: string[];
}

/** Board badge data of one task. */
export interface BacklogGitLinkSummary {
  itemId: number;
  commitCount: number;
  pullRequestCount: number;
  latestPullRequestNumber?: number | null;
  latestPullRequestState?: GitPullRequestState | null;
}

export interface GitTaskLinkCounts {
  total: number;
  processed: number;
  linked: number;
  missing: number;
  invalid: number;
  outsideProject: number;
}

export interface GitTaskLinkStats {
  commits: GitTaskLinkCounts;
  pullRequests: GitTaskLinkCounts;
  tasksWithCommits: number;
  inProgressTasksWithoutCommits: number;
}

export interface GitTaskLinkRecheckResult {
  checked: number;
  nowLinked: number;
  newlyProcessed: number;
}

export type GitPullRequestState = "OPEN" | "CLOSED" | "MERGED";

export type GitReviewState = "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";

export interface GitReviewSummary {
  approved: number;
  changesRequested: number;
  commented: number;
}

export interface GitPullRequestItem {
  id: number;
  number: number;
  title: string;
  state: GitPullRequestState;
  draft: boolean;
  authorLogin?: string | null;
  headRef?: string | null;
  baseRef?: string | null;
  htmlUrl?: string | null;
  additions?: number | null;
  deletions?: number | null;
  changedFiles?: number | null;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string | null;
  closedAt?: string | null;
  reviewSummary: GitReviewSummary;
  /** US-SY-05: Task IDs of the title, branch and body, and their verdict. */
  taskRefs: GitTaskRef[];
}

export interface GitReviewItem {
  id: number;
  reviewerLogin?: string | null;
  state: GitReviewState;
  body?: string | null;
  commitSha?: string | null;
  submittedAt?: string | null;
  dismissedAt?: string | null;
  htmlUrl?: string | null;
}

export interface GitPullRequestDetail {
  pullRequest: GitPullRequestItem;
  body?: string | null;
  mergedByLogin?: string | null;
  commitsCount?: number | null;
  reviews: GitReviewItem[];
}

export interface GitRepositoryActivity {
  /** Null (and every count 0) when no repository is linked. */
  repositoryId: number | null;
  repositoryStatus: GitRepositoryConnectionStatus | null;
  commitCount: number;
  /** US-SY-05: commits with at least one linked task. */
  linkedCommitCount: number;
  lastCommit: GitCommitItem | null;
  pullRequests: { open: number; merged: number; closed: number };
  /** Arrival of the newest processed webhook event. */
  lastEventAt?: string | null;
  /** Webhook events waiting, running or retrying. */
  pendingEvents: number;
  /** Webhook events that failed for good (can be replayed). */
  failedEvents: number;
}

export interface GitCommitQuery {
  q?: string;
  author?: string;
  branch?: string;
  link?: GitTaskLinkFilter;
  page?: number;
  size?: number;
}

export interface GitPullRequestQuery {
  state?: GitPullRequestState;
  q?: string;
  link?: GitTaskLinkFilter;
  page?: number;
  size?: number;
}

export type GitWebhookEventStatus = "RECEIVED" | "PROCESSING" | "PROCESSED" | "IGNORED" | "FAILED_RETRYABLE" | "FAILED";

export interface GitWebhookEventItem {
  id: number;
  deliveryId: string;
  eventType: string;
  action?: string | null;
  repoFullName?: string | null;
  senderLogin?: string | null;
  status: GitWebhookEventStatus;
  retryCount: number;
  maxRetries: number;
  /** Only while FAILED_RETRYABLE. */
  nextRetryAt?: string | null;
  /** Last error, why it was ignored, or what was stored. */
  note?: string | null;
  receivedAt: string;
  processedAt?: string | null;
  latencyMs?: number | null;
  replayable: boolean;
}

export interface GitWebhookEventQuery {
  status?: GitWebhookEventStatus;
  eventType?: string;
  projectId?: number;
  page?: number;
  size?: number;
}
