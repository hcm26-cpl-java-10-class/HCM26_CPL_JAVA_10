package com.example.starter_project_2025.system.project.milestone.submission.controller;

import com.example.starter_project_2025.system.project.milestone.exception.MilestoneConflictException;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice(assignableTypes = ProjectCompletionController.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ProjectCompletionErrors {
    @ExceptionHandler(MilestoneConflictException.class)
    public ResponseEntity<?> conflict(MilestoneConflictException exception) {
        return error(409, "PROJECT_COMPLETION_CONFLICT", exception.getMessage());
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<?> denied(AccessDeniedException exception) {
        return error(403, "PROJECT_COMPLETION_ACCESS_DENIED", "Project assessment access is not allowed");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> invalid(MethodArgumentNotValidException exception) {
        return error(422, "PROJECT_COMPLETION_INVALID", "Enter a score from 0 to 100 or a waiver reason of up to 500 characters");
    }

    private ResponseEntity<?> error(int status, String code, String message) {
        return ResponseEntity.status(status).body(Map.of("status", status, "code", code,
                "message", message, "correlationId", CorrelationIdFilter.currentId()));
    }
}
