package com.example.starter_project_2025.system.project;

/** AC11 semantic validation; separate from duplicate workspace/idempotency conflicts. */
public class WorkspaceRelationshipException extends RuntimeException {
    public WorkspaceRelationshipException(String message) { super(message); }
}
