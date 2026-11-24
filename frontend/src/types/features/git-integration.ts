/**
 * GI-01: GitHub App installations of the current organization (tenant).
 * Installations belong to a GitHub account or organization, not to a project.
 * Mirrors the backend DTOs.
 */

export type GitIntegrationSummaryStatus = "CONNECTED" | "NOT_CONNECTED" | "SUSPENDED" | "ERROR";

/** US-GI-02: ERROR = GitHub refused the installation (token 401/404), not confirmed as removed. */
export type GitInstallationStatus = "CONNECTED" | "SUSPENDED" | "DISCONNECTED" | "ERROR";

/** US-GI-02: the GitHub connection of a project (its master's repository's installation). No token or secret. */
export interface GitHubConnectionView {
  status: GitInstallationStatus;
  /** Why it is not connected: NOT_LINKED (no repository yet), UNINSTALLED, SUSPENDED_ON_GITHUB, TOKEN_REJECTED, INSTALLATION_NOT_FOUND… */
  reason?: string | null;
  since?: string | null;
  account?: { installationRowId: number; login: string; type: string; manageUrl: string } | null;
  repository?: { fullName: string; status: GitRepositoryConnectionStatus } | null;
  lastVerifiedAt?: string | null;
  lastCheckedAt?: string | null;
  master: { id: number; code?: string | null; name?: string | null };
  inherited: boolean;
  otherConnectedAccounts: number;
  actions: { canRecheck: boolean; canReconnect: boolean; canConnect: boolean; canLinkRepository: boolean };
}

export interface GitHubConnectionRecheck {
  connection: GitHubConnectionView;
  /** false: checked less than 30 seconds ago, nothing was asked to GitHub. */
  checked: boolean;
}

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
  /** US-GI-02: why and since when it is in its status, and the last "Check again". */
  statusReason?: string | null;
  statusChangedAt?: string | null;
  lastCheckedAt?: string | null;
  /** Master projects whose repository is read through this installation; removing the App affects them all. */
  projects?: GitInstallationProject[];
  /** US-GI-07: the viewer may disconnect it (Git Integration manager or the person who installed it). */
  canDisconnect?: boolean;
  /** US-GI-07: who disconnected it from the platform; null when removed on GitHub. */
  disconnectedBy?: { id: number; name?: string | null } | null;
}

/** US-GI-07: result of "Disconnect GitHub". */
export interface GitInstallationDisconnectResponse {
  installation: GitInstallation;
  repositoriesDisconnected: number;
  projects: GitInstallationProject[];
  /** The App had already been uninstalled on GitHub (or the installation was disconnected before). */
  alreadyRemovedOnGitHub: boolean;
}

export interface GitInstallationProject {
  id: number;
  code?: string | null;
  name?: string | null;
  repositoryFullName: string;
  repositoryStatus: GitRepositoryConnectionStatus;
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
  /** US-GI-05: this repository is linked but DISCONNECTED / ERROR: sync it again or unlink it. */
  | "GIT_REPOSITORY_NEEDS_ATTENTION"
  /** US-GI-05: the project's repository changed since the page was loaded. */
  | "GIT_REPOSITORY_CHANGED"
  /** US-GI-05: "Sync again" checked GitHub a few seconds ago. */
  | "GIT_RECHECK_TOO_SOON"
  | "GIT_REPOSITORY_IN_USE"
  | "GIT_REPOSITORY_NOT_ACCESSIBLE"
  | "GIT_REPOSITORY_ARCHIVED"
  | "GIT_REPOSITORY_NOT_LINKED"
  | "GIT_REQUEST_INVALID"
  | "GIT_PULL_REQUEST_NOT_FOUND"
  | "GIT_WEBHOOK_EVENT_NOT_FOUND"
  | "GIT_WEBHOOK_EVENT_NOT_REPLAYABLE"
  | "GIT_WEBHOOK_PAYLOAD_PURGED"
  /** US-GI-07: the account name typed to confirm "Disconnect GitHub" does not match. */
  | "GIT_DISCONNECT_CONFIRMATION_MISMATCH"
  /** US-SY-06: the synchronization is not one of the project's repositories. */
  | "GIT_SYNC_HISTORY_NOT_FOUND"
  /** US-SY-06: the repository was unlinked or disconnected: a retried webhook would only be ignored. */
  | "GIT_REPOSITORY_NOT_RECEIVING"
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

/**
 * US-GI-05: ACTIVE; INACTIVE = unlinked by a user (data kept); DISCONNECTED = GitHub took the access away
 * (still the project's repository until unlinked); ERROR = calling GitHub for it failed.
 */
export type GitRepositoryConnectionStatus = "ACTIVE" | "INACTIVE" | "DISCONNECTED" | "ERROR";

/** US-GI-05: which repository of the project a commit / pull request came from. */
export interface GitRepositoryLabel {
  id: number;
  fullName: string;
  status: GitRepositoryConnectionStatus;
}

export type GitSyncJobType = "INITIAL" | "MANUAL" | "SCHEDULED" | "WEBHOOK";

/** US-SY-01: PARTIAL = gave up after some commit pages were stored; it can resume from where it stopped. */
export type GitSyncJobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED";

export type GitSyncPhase = "METADATA" | "COMMITS" | "PULL_REQUESTS" | "DONE";

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
  stats: { branches?: number; branchesTruncated?: boolean; emptyRepository?: boolean; [key: string]: unknown };
  /** US-SY-01: step reached, commit import progress (all runs of the job). */
  phase?: GitSyncPhase;
  progress?: {
    pages: number; inserted: number; existing: number; enriched: number;
    /** US-SY-02: pull requests and reviews stored by the job. */
    pullRequests?: { pages: number; inserted: number; updated: number; unchanged: number };
    reviews?: { inserted: number; updated: number };
  };
  /** A PARTIAL / FAILED job that "Sync now" resumes from where it stopped. */
  resumable?: boolean;
  /** Waiting for the GitHub rate limit until then. */
  pausedUntil?: string | null;
  /** US-SY-06: a resume is a new job continuing this stopped one. */
  resumedFromJobId?: number | null;
}

/** US-SY-01: answer of "Sync now"; `queued = false` when a sync was already waiting, running or just done. */
export interface GitSyncRequestResult {
  job: GitSyncJob;
  queued: boolean;
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
  /** US-SY-01: commits stored for the repository, and when its whole history was last imported. */
  commitCount?: number;
  historySyncedAt?: string | null;
  /** US-SY-02: pull requests stored for the repository, and when they were last read to the end. */
  pullRequestCount?: number;
  pullRequestsSyncedAt?: string | null;
  /** US-GI-05: why it is not ACTIVE (REPOSITORY_ACCESS_REMOVED, INSTALLATION_DELETED, SYNC_FAILED…) and since when. */
  statusReason?: string | null;
  statusChangedAt?: string | null;
  /** US-GI-07: DISCONNECTED because its GitHub installation was disconnected: connect GitHub again, then link again. */
  installationGone?: boolean;
}

/** US-GI-05: a repository unlinked from the master project; its data stays in the project's analytics. */
export interface PreviousRepository {
  id: number;
  fullName: string;
  htmlUrl: string;
  linkedAt: string;
  unlinkedAt?: string | null;
  unlinkedBy?: { id: number; name?: string | null } | null;
  commitCount: number;
  pullRequestCount: number;
}

/**
 * Repository of a project; a module shows its master project's repository (`inherited`), read-only.
 * US-GI-05: `repository` is the current one (ACTIVE, ERROR or DISCONNECTED).
 */
export interface ProjectRepositoryView {
  project: { id: number; code: string; name: string; master: boolean };
  masterProject: { id: number; code: string; name: string; status: string; moduleCount: number };
  inherited: boolean;
  repository: LinkedRepository | null;
  latestSync: GitSyncJob | null;
  canLink: boolean;
  canSync: boolean;
  /** US-GI-05: "Sync again" of a repository in ERROR / DISCONNECTED (GitHub is checked first). */
  canResync: boolean;
  /** US-GI-05: "Unlink repository" (PM of the master or Git Integration manager). */
  canUnlink: boolean;
  previousRepositories: PreviousRepository[];
  /** US-SY-06: may open the synchronization history (PM of the master or Git Integration manager). */
  canViewSyncHistory?: boolean;
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
  /** US-GI-05: the repository it came from. */
  repository?: GitRepositoryLabel | null;
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
  /** WS-GH-02: project of the linked task (a module's id when the task lives in a module). */
  itemProjectId?: number | null;
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
  /** US-GI-05: the repository it came from. */
  repository?: GitRepositoryLabel | null;
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
  /**
   * The current repository; null when none is linked now. US-GI-05: the counts and the last commit
   * cover every repository the project ever linked (`repositories`).
   */
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
  /** US-GI-05: every repository the project linked, unlinked ones included. */
  repositories?: GitRepositoryLabel[];
}

export interface GitCommitQuery {
  q?: string;
  author?: string;
  branch?: string;
  link?: GitTaskLinkFilter;
  /** Local date-time (`2026-11-16T00:00:00`), inclusive lower bound of `committedAt`. */
  from?: string;
  /** Local date-time, inclusive upper bound of `committedAt`. */
  to?: string;
  page?: number;
  size?: number;
  /** US-GI-05: one repository of the project (all when absent). */
  repositoryId?: number;
}

export interface GitPullRequestQuery {
  state?: GitPullRequestState;
  q?: string;
  link?: GitTaskLinkFilter;
  page?: number;
  size?: number;
  /** US-GI-05: one repository of the project (all when absent). */
  repositoryId?: number;
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

// ---- WS-GH-02: repository activity insights ------------------------------------------------------

export type GitInsightsRange = "7d" | "30d" | "90d";

export interface GitDailyActivity {
  /** Local date `2026-11-19`. */
  date: string;
  commits: number;
  pullRequestsOpened: number;
  pullRequestsMerged: number;
}

/** A person of the period; `matched` is false when the commits carry no GitHub login (grouped by name). */
export interface GitContributorStat {
  login: string | null;
  name: string | null;
  matched: boolean;
  commits: number;
  pullRequestsOpened: number;
  reviews: number;
  lastActiveAt: string | null;
  /** US-GI-06: the project member this person counts for (GitHub account or assigned e-mail). */
  userId?: number | null;
  memberName?: string | null;
  mapped?: boolean;
  /** US-GI-06: an unmapped person the PM can open in the Members view. */
  contributorId?: number | null;
}

/** A branch commits were first pushed to (without refs/heads/). */
export interface GitBranchItem {
  name: string;
  commits: number;
  lastCommitAt: string | null;
}

export type GitPullRequestAttention = "CHANGES_REQUESTED" | "AWAITING_REVIEW" | "STALE";

export interface GitRepositoryInsights {
  /** Null (counts 0, lists empty, `daily` still complete) when no repository is linked. */
  repositoryId: number | null;
  range: GitInsightsRange;
  from: string;
  to: string;
  generatedAt: string;
  summary: {
    commits: number;
    activeDays: number;
    contributors: number;
    pullRequestsOpened: number;
    pullRequestsMerged: number;
    medianHoursToMerge: number | null;
  };
  daily: GitDailyActivity[];
  contributors: GitContributorStat[];
  otherContributors: number;
  branches: GitBranchItem[];
  /** Current open pull requests; does not depend on the range. */
  pullRequests: {
    open: number;
    awaitingReview: number;
    changesRequested: number;
    stale: number;
    staleDays: number;
    attention: Array<{ reason: GitPullRequestAttention; pullRequest: GitPullRequestItem }>;
  };
  /** True when the period had more commits than the server reads (counts are a lower bound). */
  truncated: boolean;
}

// ---- US-GI-06 · Connect GitHub account & map to project member -------------------------------------

/** A verified GitHub account; the id is the identity, the login is for display. */
export interface GitAccountView {
  githubUserId: number;
  login: string;
  avatarUrl?: string | null;
}

export interface GitAccountConnectResponse {
  outcome: "CONNECTED" | "AUTHORIZE_REQUIRED";
  authorizeUrl?: string | null;
  expiresAt?: string | null;
  account?: GitAccountView | null;
  master: GitProjectSummary;
  message?: string | null;
}

export interface GitAccountCallbackRequest {
  state: string;
  code?: string;
  error?: string;
  errorDescription?: string;
}

export type GitContributorMapSource = "OAUTH" | "IDENTITY" | "MANUAL";
export type GitContributorKind = "GITHUB" | "EMAIL";

export interface GitAccountActivity {
  commits: number;
  pullRequests: number;
  reviews: number;
  lastActiveAt: string | null;
}

export interface GitAccountMember {
  userId: number;
  name: string;
  email: string | null;
  roles: string[];
  projects: GitProjectSummary[];
  /** False for a mapped user who no longer belongs to the master or its modules. */
  member: boolean;
  github: { contributorId: number; login: string | null; source: GitContributorMapSource | null; mappedAt: string | null } | null;
  emails: Array<{ contributorId: number; email: string | null; mappedByName: string | null; mappedAt: string | null }>;
  activity: GitAccountActivity;
}

export interface GitUnmappedContributor {
  contributorId: number;
  kind: GitContributorKind;
  login: string | null;
  email: string | null;
  displayName: string | null;
  activity: GitAccountActivity;
  /** Only orders the assign list; nothing is assigned without the PM. */
  suggestedUserId: number | null;
}

export interface GitAccountsOverview {
  master: GitProjectSummary;
  viewer: {
    userId: number;
    identity: GitAccountView | null;
    mapped: boolean;
    canConnect: boolean;
    canManage: boolean;
  };
  members: GitAccountMember[];
  unmapped: GitUnmappedContributor[];
  summary: { members: number; connected: number; unmappedContributors: number };
}

export interface GitContributorView {
  contributorId: number;
  kind: GitContributorKind;
  login: string | null;
  email: string | null;
  displayName: string | null;
  userId: number | null;
  source: GitContributorMapSource | null;
  mappedAt: string | null;
}

// ---- US-SY-06 · Synchronization history -----------------------------------------------------------

export type GitSyncHistorySource = "JOB" | "WEBHOOK";
/** BR3: SCHEDULED jobs are the periodic reconcile. */
export type GitSyncHistoryType = "INITIAL" | "MANUAL" | "RECONCILE" | "WEBHOOK";
/** BR4: PARTIAL_SUCCESS = finished, but part of the data could not be read. */
export type GitSyncHistoryStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";

export interface GitSyncHistoryItem {
  source: GitSyncHistorySource;
  id: number;
  repository?: GitRepositoryLabel | null;
  type: GitSyncHistoryType;
  status: GitSyncHistoryStatus;
  rawStatus: string;
  /** Queued (job) or received (webhook); the list is ordered by it. */
  occurredAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
  /** Commits, pull requests and reviews processed; null when unknown. */
  recordsProcessed?: number | null;
  attempts: number;
  /** Job: why it failed / stopped / waits. */
  errorCode?: string | null;
  /** Webhook: the error of a failed delivery, one line. */
  error?: string | null;
  eventType?: string | null;
  action?: string | null;
  /** The platform tries again by itself at this time. */
  retryAt?: string | null;
  canRetry: boolean;
}

export interface GitSyncHistoryPage extends GitPage<GitSyncHistoryItem> {
  /** false: the project never linked a repository. */
  hasRepository: boolean;
  /** The repository shown (the current one unless another was asked for). */
  repositoryId?: number | null;
  repositories: GitRepositoryLabel[];
}

export interface GitSyncHistoryQuery {
  type?: GitSyncHistoryType;
  status?: GitSyncHistoryStatus;
  repositoryId?: number;
  page?: number;
  size?: number;
}

export interface GitSyncHistoryDetail {
  item: GitSyncHistoryItem;
  breakdown?: {
    commitsInserted?: number | null; commitsExisting?: number | null;
    pullRequestsInserted?: number | null; pullRequestsUpdated?: number | null; pullRequestsUnchanged?: number | null;
    reviewsInserted?: number | null; reviewsUpdated?: number | null;
  } | null;
  error?: { code?: string | null; message?: string | null } | null;
  /** What a processed webhook did, in the platform's words. */
  note?: string | null;
  job?: {
    phase: GitSyncPhase;
    resumedFromJobId?: number | null;
    requestedBy?: { id: number; name?: string | null } | null;
    maxAttempts: number;
    canSyncAgain: boolean;
  } | null;
  webhook?: {
    deliveryId: string;
    senderLogin?: string | null;
    maxRetries: number;
    receivedAt: string;
    payloadAvailable: boolean;
    retryBlockedReason?: "PAYLOAD_PURGED" | "REPOSITORY_NOT_RECEIVING" | string | null;
  } | null;
}
