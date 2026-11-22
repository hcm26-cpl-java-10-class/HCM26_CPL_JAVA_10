package com.example.starter_project_2025.system.git_integration.service;

/** GI-02: why an installation's status last changed ({@code git_installations.status_reason}); shown in words by the UI. */
public final class GitInstallationReason {

    /** Connected (again) through the Connect GitHub callback. */
    public static final String CONNECTED = "CONNECTED";
    /** GitHub answered 404 for the installation (token or "Check again" before it was confirmed). */
    public static final String INSTALLATION_NOT_FOUND = "INSTALLATION_NOT_FOUND";
    /** GitHub refused installation tokens (401) twice in a row. */
    public static final String TOKEN_REJECTED = "TOKEN_REJECTED";
    /** The account owner suspended the App. */
    public static final String SUSPENDED_ON_GITHUB = "SUSPENDED_ON_GITHUB";
    /** The App was uninstalled (webhook "deleted", or "Check again" got 404). */
    public static final String UNINSTALLED = "UNINSTALLED";
    /** The account owner lifted the suspension. */
    public static final String UNSUSPENDED = "UNSUSPENDED";
    /** "Check again" found the installation working. */
    public static final String RECHECK_OK = "RECHECK_OK";
    /** A new installation token was issued for an installation in ERROR: it works again. */
    public static final String TOKEN_ISSUED = "TOKEN_ISSUED";

    private GitInstallationReason() {
    }
}
