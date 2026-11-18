package com.example.starter_project_2025.system.git_integration.domain;

/**
 * How a backlog item ↔ Git link was made. AUTO links follow the Task IDs of the commit or
 * pull request (SY-05); MANUAL links are made or pinned by a user and are never removed or
 * changed by automatic mapping (TM-03).
 */
public enum BacklogLinkSource {
    AUTO,
    MANUAL
}
