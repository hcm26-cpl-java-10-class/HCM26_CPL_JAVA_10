import type { GitOAuthOutcome } from "@/types/features/git-integration";

export type GitIntegrationTone = "success" | "warning" | "error" | "neutral" | "info";

/** What the user can do next from a result screen. */
export type GitIntegrationNextAction = "integration" | "retry" | "dashboard" | "signin";

export interface GitIntegrationMessage {
  tone: GitIntegrationTone;
  title: string;
  description: string;
  action: GitIntegrationNextAction;
}

/**
 * Copy for every callback outcome and backend error `code`. The backend
 * message is never shown as-is so the UI keeps one voice (English, like the
 * other Project Management pages).
 */
const OUTCOMES: Partial<Record<GitOAuthOutcome, GitIntegrationMessage>> = {
  CONNECTED: {
    tone: "success",
    title: "GitHub connected",
    description: "The installation was verified and added to your organization's GitHub connections.",
    action: "integration",
  },
  RECONNECTED: {
    tone: "success",
    title: "Connection updated",
    description: "This GitHub account was already connected. Its details were refreshed — no duplicate was created.",
    action: "integration",
  },
  PENDING_APPROVAL: {
    tone: "warning",
    title: "Waiting for owner approval",
    description:
      "Your install request was sent to the organization owner. Connect again once they approve the GitHub App.",
    action: "integration",
  },
};

const ERRORS: Record<string, GitIntegrationMessage> = {
  GIT_AUTHORIZATION_DENIED: {
    tone: "warning",
    title: "You declined the GitHub authorization",
    description: "No connection was created. You can start again whenever you are ready.",
    action: "retry",
  },
  GIT_STATE_INVALID: {
    tone: "error",
    title: "This connection link is invalid or has expired",
    description: "For your security each attempt is valid for 10 minutes and can only be used once. Please start again.",
    action: "retry",
  },
  GIT_CALLBACK_INVALID: {
    tone: "error",
    title: "GitHub returned incomplete data",
    description: "The authorization could not be verified, so nothing was saved. Please start again.",
    action: "retry",
  },
  GIT_INSTALLATION_NOT_OWNED: {
    tone: "error",
    title: "This installation doesn't belong to your GitHub account",
    description: "We only link installations the authorizing GitHub user can access. Nothing was saved.",
    action: "retry",
  },
  GIT_INSTALLATION_LINKED_ELSEWHERE: {
    tone: "error",
    title: "Connected by another organization",
    description: "This GitHub installation already belongs to another organization on this platform and was not changed.",
    action: "integration",
  },
  GIT_INTEGRATION_FORBIDDEN: {
    tone: "neutral",
    title: "You don't have permission to manage Git Integration",
    description: "Ask your program manager to grant the Git Integration permission.",
    action: "dashboard",
  },
  GIT_PROVIDER_UNAVAILABLE: {
    tone: "error",
    title: "GitHub is not reachable right now",
    description: "Nothing was saved. Please wait a moment and start again.",
    action: "retry",
  },
  GIT_INTEGRATION_DISABLED: {
    tone: "neutral",
    title: "GitHub integration is not enabled",
    description: "An administrator needs to configure the GitHub App on the server first.",
    action: "dashboard",
  },
  GIT_INSTALLATION_NOT_FOUND: {
    tone: "neutral",
    title: "GitHub connection not found",
    description: "It may have been removed. Reload Git Integration to see the current connections.",
    action: "integration",
  },
  GIT_INSTALLATION_NOT_ACTIVE: {
    tone: "warning",
    title: "This GitHub connection is not active",
    description: "The app was suspended or uninstalled on GitHub. Check the connection status, then try again.",
    action: "integration",
  },
  GIT_RATE_LIMITED: {
    tone: "warning",
    title: "GitHub rate limit reached",
    description: "GitHub is limiting requests for this connection. Please try again in a few minutes.",
    action: "retry",
  },
  UNAUTHENTICATED: {
    tone: "neutral",
    title: "Your session has ended",
    description: "Please sign in again, then start Connect GitHub from Git Integration.",
    action: "signin",
  },
};

const FALLBACK: GitIntegrationMessage = {
  tone: "error",
  title: "Something went wrong",
  description: "The connection could not be completed. Please start again.",
  action: "retry",
};

export function outcomeMessage(outcome: GitOAuthOutcome): GitIntegrationMessage {
  return OUTCOMES[outcome] ?? FALLBACK;
}

export function errorMessage(code?: string, httpStatus?: number): GitIntegrationMessage {
  if (code && ERRORS[code]) return ERRORS[code];
  if (httpStatus === 401) return ERRORS.UNAUTHENTICATED;
  if (httpStatus === 403) return ERRORS.GIT_INTEGRATION_FORBIDDEN;
  return FALLBACK;
}
