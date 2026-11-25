package com.example.starter_project_2025.system.git_integration.domain;

/** Result recorded on an OAuth state once its callback has been processed. */
public enum GitOAuthOutcome {
    CONNECTED,
    RECONNECTED,
    DENIED,
    PENDING_APPROVAL,
    INVALID_CALLBACK,
    INSTALLATION_NOT_OWNED,
    LINKED_ELSEWHERE,
    PROVIDER_ERROR,
    // GI-06: Connect GitHub account
    ACCOUNT_LINKED,
    IDENTITY_LINKED_ELSEWHERE,
    MAPPED_TO_OTHER_MEMBER,
    NOT_PROJECT_MEMBER,
    IDENTITY_MISMATCH
}
