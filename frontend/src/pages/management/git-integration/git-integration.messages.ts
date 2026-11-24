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
  GIT_DISCONNECT_CONFIRMATION_MISMATCH: {
    tone: "warning",
    title: "The name doesn't match",
    description: "Type the account or organization name exactly as shown. Nothing was changed.",
    action: "retry",
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
  // US-GI-02
  GIT_INSTALLATION_ERROR: {
    tone: "error",
    title: "GitHub refused the connection",
    description: "Check the GitHub connection again, or reconnect GitHub on the Git Integration page.",
    action: "integration",
  },
  GIT_RATE_LIMITED: {
    tone: "warning",
    title: "GitHub rate limit reached",
    description: "GitHub is limiting requests for this connection. Please try again in a few minutes.",
    action: "retry",
  },
  // ---- US-GI-04 · link a repository ----
  GIT_PROJECT_NOT_FOUND: {
    tone: "neutral",
    title: "Project not found",
    description: "The project may have been removed or is outside your organization.",
    action: "dashboard",
  },
  GIT_PROJECT_NOT_MASTER: {
    tone: "warning",
    title: "Modules share the master project's repository",
    description: "Link the repository from the master project. Every module uses it automatically.",
    action: "integration",
  },
  GIT_PROJECT_NOT_LINKABLE: {
    tone: "neutral",
    title: "This project has ended",
    description: "Completed or cancelled projects can't be linked to a repository.",
    action: "integration",
  },
  GIT_PROJECT_ALREADY_LINKED: {
    tone: "warning",
    title: "This project already has a linked repository",
    description: "A master project has one repository at a time. Unlink the current repository first, then link the new one.",
    action: "integration",
  },
  GIT_REPOSITORY_IN_USE: {
    tone: "warning",
    title: "This repository is already in use",
    description: "Each repository can be linked to only one master project.",
    action: "integration",
  },
  GIT_REPOSITORY_NEEDS_ATTENTION: {
    tone: "warning",
    title: "This repository is already linked, but needs attention",
    description: "GitHub no longer gives access to it or its last sync failed. Use \"Sync again\", or unlink it.",
    action: "integration",
  },
  GIT_REPOSITORY_CHANGED: {
    tone: "warning",
    title: "The project's repository just changed",
    description: "Someone else changed it a moment ago. Review the repository again before you continue.",
    action: "integration",
  },
  GIT_RECHECK_TOO_SOON: {
    tone: "info",
    title: "Checked a moment ago",
    description: "GitHub was asked a few seconds ago. Wait a little, then try again.",
    action: "integration",
  },
  GIT_REPOSITORY_NOT_ACCESSIBLE: {
    tone: "error",
    title: "No access to this repository",
    description: "The GitHub App no longer has access to it. Grant access on GitHub, refresh the list, then try again.",
    action: "integration",
  },
  GIT_REPOSITORY_ARCHIVED: {
    tone: "neutral",
    title: "Archived repositories can't be linked",
    description: "Unarchive it on GitHub or choose another repository.",
    action: "integration",
  },
  GIT_REPOSITORY_NOT_LINKED: {
    tone: "neutral",
    title: "No repository linked",
    description: "Link a repository to this project first.",
    action: "integration",
  },
  GIT_REQUEST_INVALID: {
    tone: "error",
    title: "The request is incomplete",
    description: "Choose a GitHub account and a repository, then try again.",
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

/** US-GI-04: why the last synchronization failed, in words. */
const SYNC_ERRORS: Record<string, string> = {
  REPOSITORY_NOT_ACCESSIBLE: "The GitHub App can no longer access this repository.",
  INSTALLATION_DISCONNECTED: "The GitHub App was uninstalled from this account.",
  INSTALLATION_SUSPENDED: "The GitHub App installation is suspended.",
  INSTALLATION_NOT_ACTIVE: "The GitHub connection is not active.",
  REPOSITORY_NOT_ACTIVE: "The repository is no longer linked.",
  PROVIDER_UNAVAILABLE: "GitHub could not be reached.",
  RATE_LIMITED: "GitHub rate limit reached; it will retry automatically.",
  WORKER_LOST: "The previous attempt did not finish.",
  SYNC_ERROR: "An unexpected error occurred while synchronizing.",
  // US-SY-01: commit history.
  HISTORY_UNAVAILABLE: "GitHub stopped responding while the commit history was being imported.",
  HISTORY_FORBIDDEN: "The GitHub App is not allowed to read this repository's contents. Grant it \"Contents: Read\" on GitHub, then sync again.",
  // US-SY-02: pull requests and reviews.
  // US-GI-02
  INSTALLATION_ERROR: "GitHub refused the connection. Check the GitHub connection again, or reconnect GitHub.",
  PULL_REQUESTS_UNAVAILABLE: "GitHub stopped responding while the pull requests were being imported.",
  PULL_REQUESTS_FORBIDDEN: "The GitHub App is not allowed to read this repository's pull requests. Grant it \"Pull requests: Read\" on GitHub, then sync again.",
  // US-GI-05
  REPOSITORY_UNLINKED: "The repository was unlinked from the project.",
  REPOSITORY_DISCONNECTED: "GitHub no longer gives access to the repository.",
};

/** US-GI-05: why the project's repository is not ACTIVE, as a heading and an explanation. */
const REPOSITORY_REASONS: Record<string, { title: string; description: string }> = {
  REPOSITORY_ACCESS_REMOVED: {
    title: "GitHub no longer gives access to this repository",
    description: "It was removed from the GitHub App's repositories. Grant the App access to it again on GitHub, then check again.",
  },
  INSTALLATION_DELETED: {
    title: "GitHub was disconnected from this repository's account",
    description: "The GitHub App was uninstalled, so the repository isn't synchronized any more. Connect GitHub again, then link the repository again.",
  },
  REPOSITORY_DELETED: {
    title: "This repository was deleted on GitHub",
    description: "Unlink it and link the team's new repository.",
  },
  REPOSITORY_NOT_ACCESSIBLE: {
    title: "GitHub couldn't find this repository",
    description: "The App may have lost access, or the repository moved. Check again, or grant access on GitHub.",
  },
  SYNC_FAILED: {
    title: "The last sync of this repository failed",
    description: "Sync again to retry. New data isn't collected until a sync succeeds.",
  },
  REPOSITORY_LINKED_ELSEWHERE: {
    title: "Another project now uses this repository",
    description: "Access came back, but another project synchronizes it meanwhile. Unlink it here, or unlink it from the other project.",
  },
  LEGACY_UNAVAILABLE: {
    title: "This repository is no longer accessible",
    description: "Grant the GitHub App access to it again, or unlink it and link another repository.",
  },
};

export function repositoryReasonMessage(reason?: string | null, status?: string) {
  return (reason && REPOSITORY_REASONS[reason])
    || (status === "ERROR" ? REPOSITORY_REASONS.SYNC_FAILED : REPOSITORY_REASONS.LEGACY_UNAVAILABLE);
}

export function syncErrorMessage(code?: string | null) {
  return (code && SYNC_ERRORS[code]) || "The synchronization could not be completed.";
}

/** US-SY-04: why a webhook event could not be replayed, in words. */
const REPLAY_ERRORS: Record<string, string> = {
  GIT_WEBHOOK_EVENT_NOT_REPLAYABLE: "Only failed events, or ignored push / pull request / review events, can be processed again.",
  GIT_WEBHOOK_PAYLOAD_PURGED: "The event's payload was removed after the retention period, so it can't be processed again.",
  GIT_WEBHOOK_EVENT_NOT_FOUND: "This event no longer exists.",
  GIT_INTEGRATION_FORBIDDEN: "Only people who manage Git Integration can replay events.",
};

export function replayErrorMessage(code?: string) {
  return (code && REPLAY_ERRORS[code]) || "The event could not be queued again. Please try again.";
}

/** US-SY-06: why a failed webhook delivery could not be retried from the sync history. */
const SYNC_HISTORY_RETRY_ERRORS: Record<string, string> = {
  GIT_WEBHOOK_EVENT_NOT_REPLAYABLE: "This delivery is no longer failed. The list has been refreshed.",
  GIT_WEBHOOK_PAYLOAD_PURGED: "The delivery's content was removed after the retention period, so it can't be processed again. Sync the repository instead.",
  GIT_REPOSITORY_NOT_RECEIVING: "The repository was unlinked or lost its connection, so the delivery would only be ignored.",
  GIT_SYNC_HISTORY_NOT_FOUND: "This delivery is not one of this project's repository.",
  GIT_INTEGRATION_FORBIDDEN: "Only the project manager can retry deliveries.",
};

export function syncHistoryRetryErrorMessage(code?: string) {
  return (code && SYNC_HISTORY_RETRY_ERRORS[code]) || "The delivery could not be queued again. Please try again.";
}

/** US-SY-06: why a failed delivery offers no Retry. */
export function retryBlockedMessage(reason?: string | null) {
  if (reason === "PAYLOAD_PURGED") return "Its content was removed after the retention period. Sync the repository to collect any missing data.";
  if (reason === "REPOSITORY_NOT_RECEIVING") return "The repository was unlinked or lost its connection.";
  return null;
}

/** US-TM-03: why a manual link / unlink failed, in words. */
const TASK_LINK_ERRORS: Record<string, string> = {
  GIT_PULL_REQUEST_NOT_FOUND: "No pull request with that number in this project's repository.",
  GIT_REPOSITORY_NOT_LINKED: "This task's project has no linked repository yet.",
  GIT_TASK_OUTSIDE_PROJECT: "This task is not in the repository's project or one of its modules.",
  GIT_TASK_INACTIVE: "This task was deleted, so it can't be linked.",
  GIT_TASK_LINK_NOT_FOUND: "This link was already removed.",
  GIT_BACKLOG_ITEM_NOT_FOUND: "This task no longer exists or you can't open it.",
};

export function taskLinkErrorMessage(code?: string, httpStatus?: number) {
  if (code && TASK_LINK_ERRORS[code]) return TASK_LINK_ERRORS[code];
  if (httpStatus === 403) return "You need permission to update this task.";
  return errorMessage(code, httpStatus).description;
}

/** US-GI-06: why "Connect GitHub account" or a mapping change did not go through, in words. */
const ACCOUNT_ERRORS: Record<string, Omit<GitIntegrationMessage, "action">> = {
  GIT_AUTHORIZATION_DENIED: {
    tone: "warning",
    title: "GitHub access was not granted",
    description: "Nothing changed. You can connect again any time.",
  },
  GIT_STATE_INVALID: {
    tone: "error",
    title: "This link has expired",
    description: "Each attempt is valid for 10 minutes and works once. Start again from the GitHub tab.",
  },
  GIT_CALLBACK_INVALID: {
    tone: "error",
    title: "GitHub returned incomplete data",
    description: "Your account could not be verified, so nothing was saved. Please try again.",
  },
  GIT_IDENTITY_LINKED_ELSEWHERE: {
    tone: "error",
    title: "This GitHub account belongs to another user",
    description: "Sign in to GitHub with your own account, then connect again. Ask an admin if this is your account.",
  },
  GIT_IDENTITY_MISMATCH: {
    tone: "warning",
    title: "You are already linked to another GitHub account",
    description: "Connect with that account, or ask an admin to unlink it first.",
  },
  GIT_ACCOUNT_MAPPED_TO_OTHER_MEMBER: {
    tone: "error",
    title: "Already used by another member of this project",
    description: "Ask your PM to check the Members list of the GitHub tab.",
  },
  GIT_NOT_PROJECT_MEMBER: {
    tone: "neutral",
    title: "You are not a member of this project",
    description: "Only members of the project or one of its modules can connect a GitHub account.",
  },
  GIT_ASSIGNEE_NOT_MEMBER: {
    tone: "warning",
    title: "Not a member of this project",
    description: "Pick someone from the project or one of its modules.",
  },
  GIT_CONTRIBUTOR_HAS_GITHUB_ID: {
    tone: "neutral",
    title: "Only the account owner can connect it",
    description: "This contributor has a GitHub account; ask them to connect it from the GitHub tab.",
  },
  GIT_CONTRIBUTOR_NOT_FOUND: {
    tone: "neutral",
    title: "Contributor not found",
    description: "The list changed in the meantime. It has been refreshed.",
  },
  GIT_ACCOUNT_MAPPING_NOT_FOUND: {
    tone: "neutral",
    title: "Already unlinked",
    description: "This member's GitHub account was not linked any more.",
  },
  GIT_PROVIDER_UNAVAILABLE: {
    tone: "error",
    title: "GitHub is not responding",
    description: "Nothing was saved. Try again in a minute.",
  },
};

export function accountErrorMessage(code?: string, httpStatus?: number): GitIntegrationMessage {
  const known = code ? ACCOUNT_ERRORS[code] : undefined;
  if (known) return { ...known, action: "retry" };
  return errorMessage(code, httpStatus);
}
