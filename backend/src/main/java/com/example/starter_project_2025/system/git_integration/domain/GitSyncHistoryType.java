package com.example.starter_project_2025.system.git_integration.domain;

/** SY-06: the four kinds of synchronization of the history (BR3). Jobs SCHEDULED are the periodic reconcile. */
public enum GitSyncHistoryType {
    INITIAL,
    MANUAL,
    RECONCILE,
    WEBHOOK;

    public static GitSyncHistoryType of(GitSyncJobType type) {
        return switch (type) {
            case INITIAL -> INITIAL;
            case MANUAL -> MANUAL;
            case SCHEDULED -> RECONCILE;
            case WEBHOOK -> WEBHOOK;
        };
    }
}
