package com.example.starter_project_2025.system.project;

import lombok.Getter;

@Getter
public class WorkspaceConflictException extends RuntimeException {
    private final Long workspaceId;
    public WorkspaceConflictException(String message, Long workspaceId) {
        super(message);
        this.workspaceId = workspaceId;
    }
}
