package com.example.starter_project_2025.system.project.workspace.domain;

public enum WorkspaceSection {
    OVERVIEW("overview"), MEMBERS("members"), MILESTONE("milestones"), SPRINT("sprints"),
    BACKLOG("backlog"), ARTIFACT("artifacts"), FEEDBACK("feedback"), ACTIVITY("activity");

    private final String key;
    WorkspaceSection(String key) { this.key = key; }
    public String getKey() { return key; }
}
