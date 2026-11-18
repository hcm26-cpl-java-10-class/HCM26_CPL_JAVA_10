package com.example.starter_project_2025.system.git_integration.domain;

/** SY-05: where a Task ID was found. A commit only has a message; a pull request has a title and a description (body). */
public enum BacklogReferenceField {
    MESSAGE,
    TITLE,
    /** Read from old rows only: since TM-03 the branch name of a pull request is not a source. */
    BRANCH,
    BODY,
    /**
     * A merge / squash commit takes the tasks of the pull request it merged: GitHub copies
     * only the title into its message, never the description (column holds 10 characters).
     */
    MERGED_PR,
    /** No Task ID at all ({@link BacklogReferenceStatus#MISSING}). */
    NONE
}
