package com.example.starter_project_2025.system.git_integration.domain;

/**
 * Lifecycle of a GitHub App installation on the platform. See the state
 * diagram in docs/git-integration/US-GIT-001-redesign-installation-plan.md (section 9).
 */
public enum GitInstallationStatus {
    /** Installed, verified, not suspended: the platform may use it. */
    CONNECTED,
    /** The account owner suspended the app on GitHub. */
    SUSPENDED,
    /** Uninstalled on GitHub or disconnected from the platform; kept for history. */
    DISCONNECTED
}
