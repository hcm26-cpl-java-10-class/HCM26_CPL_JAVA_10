package com.example.starter_project_2025.system.project.milestone.exception;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.milestone.controller.MilestoneController;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.*;

@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = MilestoneController.class)
public class MilestoneExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<MilestoneErrorResponse> handleBeanValidation(MethodArgumentNotValidException ex) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            errors.computeIfAbsent(fieldError.getField(), ignored -> new ArrayList<>())
                    .add(fieldError.getDefaultMessage());
        }
        return error(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED",
                "Milestone data is invalid", errors);
    }

    @ExceptionHandler(MilestoneValidationException.class)
    public ResponseEntity<MilestoneErrorResponse> handleMilestoneValidation(MilestoneValidationException ex) {
        return error(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED",
                "Milestone data is invalid", ex.getErrors());
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<MilestoneErrorResponse> handleMissingHeader(MissingRequestHeaderException ex) {
        Map<String, List<String>> errors = Map.of(
                "idempotencyKey", List.of("Idempotency-Key header is required")
        );
        return error(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED",
                "Milestone data is invalid", errors);
    }

    @ExceptionHandler(MilestoneConflictException.class)
    public ResponseEntity<MilestoneErrorResponse> handleConflict(MilestoneConflictException ex) {
        return error(HttpStatus.CONFLICT, "CONFLICT", ex.getMessage(), Map.of());
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<MilestoneErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        return error(HttpStatus.FORBIDDEN, "ACCESS_DENIED",
                "You no longer have permission to create this milestone", Map.of());
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<MilestoneErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        return error(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", ex.getMessage(), Map.of());
    }

    private ResponseEntity<MilestoneErrorResponse> error(
            HttpStatus status,
            String code,
            String message,
            Map<String, List<String>> errors
    ) {
        return ResponseEntity.status(status).body(new MilestoneErrorResponse(
                status.value(), code, message, errors,
                CorrelationIdFilter.currentId(), Instant.now()
        ));
    }
}
