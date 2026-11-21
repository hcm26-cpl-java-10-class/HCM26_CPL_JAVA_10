package com.example.starter_project_2025.system.git_integration.domain;

/** GI-06: how a user's GitHub identity was verified. */
public enum GitIdentitySource {
    /** The user authorized the GitHub App (GET /user with their own token). */
    OAUTH,
    /** Taken over from the GitHub App installation the user connected (GI-01, also verified with GET /user). */
    INSTALLATION,
    /** Reserved for a future "Sign in with GitHub". */
    LOGIN
}
