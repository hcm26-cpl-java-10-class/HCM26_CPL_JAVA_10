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
    DISCONNECTED,
    /**
     * GI-02: GitHub refused an installation token (401) or reported the installation missing (404),
     * not confirmed as uninstalled yet. Linked repositories stay; "Check again" or the next token
     * decides (CONNECTED, SUSPENDED or DISCONNECTED).
     */
    ERROR;

    /** GI-02: the platform cannot use the installation and someone should reconnect it. */
    public boolean broken() {
        return this != CONNECTED;
    }
}
