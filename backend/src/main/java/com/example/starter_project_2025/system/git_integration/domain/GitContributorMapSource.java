package com.example.starter_project_2025.system.git_integration.domain;

/** GI-06: how a contributor was mapped to a project member. */
public enum GitContributorMapSource {
    /** The member authorized GitHub during Connect. */
    OAUTH,
    /** The member's already verified identity was reused (no redirect to GitHub). */
    IDENTITY,
    /** A PM assigned an e-mail-only contributor (AN-06). */
    MANUAL
}
