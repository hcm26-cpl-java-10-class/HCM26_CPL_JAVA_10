package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import lombok.Getter;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Getter
public class AssignmentException extends ResponseStatusException {
    private final String code;

    public AssignmentException(HttpStatus status, String code, String message) {
        super(status, message);
        this.code = code;
    }

    public static AssignmentException invalid(String message) {
        return new AssignmentException(HttpStatus.UNPROCESSABLE_ENTITY, "PROJECT_ASSIGNMENT_INVALID", message);
    }

    public static AssignmentException busy(String teamName) {
        return new AssignmentException(HttpStatus.CONFLICT, "PROJECT_ASSIGNMENT_TEAM_BUSY",
                "The selected team already has an unfinished project. Please review its assignment: " + teamName);
    }
}
