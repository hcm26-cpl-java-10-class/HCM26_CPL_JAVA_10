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
