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
  | "UNAUTHENTICATED";

export interface GitIntegrationErrorBody {
  status: number;
  code: GitIntegrationErrorCode | string;
  message: string;
  correlationId?: string;
}
