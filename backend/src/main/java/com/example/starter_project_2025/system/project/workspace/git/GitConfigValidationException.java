package com.example.starter_project_2025.system.project.workspace.git;

public class GitConfigValidationException extends RuntimeException {
    private final String field;
    public GitConfigValidationException(String field, String message) {
        super(message);
        this.field = field;
    }
    public String field() { return field; }
}
