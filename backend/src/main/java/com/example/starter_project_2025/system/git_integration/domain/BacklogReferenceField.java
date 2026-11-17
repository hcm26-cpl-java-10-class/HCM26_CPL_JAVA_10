package com.example.starter_project_2025.system.git_integration.domain;

/** SY-05: where a Task ID was found. A commit only has a message; a pull request has a title, a branch and a body. */
public enum BacklogReferenceField {
    MESSAGE,
    TITLE,
    BRANCH,
    BODY,
    /** No Task ID at all ({@link BacklogReferenceStatus#MISSING}). */
    NONE
}
