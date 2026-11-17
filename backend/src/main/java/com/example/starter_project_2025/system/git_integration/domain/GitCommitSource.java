package com.example.starter_project_2025.system.git_integration.domain;

/** SY-04: where the data of a stored commit came from. */
public enum GitCommitSource {
    /** The {@code commits} array of a push webhook (the normal case). */
    WEBHOOK_PAYLOAD,
    /** GitHub Compare API, used when the push payload was truncated. */
    COMPARE_API,
    /** GitHub List Commits API, used when Compare could not return every commit. */
    LIST_COMMITS_API
}
