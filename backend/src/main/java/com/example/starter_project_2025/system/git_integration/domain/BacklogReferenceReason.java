package com.example.starter_project_2025.system.git_integration.domain;

/** SY-05: detail of a {@link BacklogReferenceStatus}. */
public enum BacklogReferenceReason {
    OK,
    NOT_FOUND,
    DELETED,
    OTHER_PROJECT,
    NO_TASK_ID,
    /** TM-03: see {@link BacklogReferenceStatus#EXCLUDED}. */
    UNLINKED_BY_USER
}
