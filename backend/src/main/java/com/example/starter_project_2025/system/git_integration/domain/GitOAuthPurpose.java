package com.example.starter_project_2025.system.git_integration.domain;

/** What a {@link GitOAuthState} was issued for; a state is only accepted by the flow of its purpose. */
public enum GitOAuthPurpose {
    /** GI-01: install the GitHub App on an account or organization. */
    INSTALL,
    /** GI-06: prove ownership of a GitHub account and map it to a project member. */
    ACCOUNT_LINK
}
