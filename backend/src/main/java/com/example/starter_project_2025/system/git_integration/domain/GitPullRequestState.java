package com.example.starter_project_2025.system.git_integration.domain;

/** SY-04: state of a pull request; MERGED is a closed pull request whose changes were merged. */
public enum GitPullRequestState {
    OPEN,
    CLOSED,
    MERGED
}
