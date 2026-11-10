package com.example.starter_project_2025.system.project.milestone.submission.controller;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.milestone.exception.*;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.*;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.Instant;
import java.util.*;

@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = MilestoneSubmissionController.class)
public class SubmissionExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<MilestoneErrorResponse> validation(MethodArgumentNotValidException ex) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            errors.computeIfAbsent(error.getField(), ignored -> new ArrayList<>()).add(error.getDefaultMessage());
        }
        return error(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED", "Review data is invalid", errors);
    }

    @ExceptionHandler(MilestoneValidationException.class)
    ResponseEntity<MilestoneErrorResponse> validation(MilestoneValidationException ex) {
        return error(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED", "Review data is invalid", ex.getErrors());
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    ResponseEntity<MilestoneErrorResponse> missingHeader(MissingRequestHeaderException ex) {
        return error(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED", "Review data is invalid",
                Map.of("idempotencyKey", List.of("Idempotency-Key is required")));
    }

    @ExceptionHandler(MilestoneConflictException.class)
    ResponseEntity<MilestoneErrorResponse> conflict(MilestoneConflictException ex) {
        return error(HttpStatus.CONFLICT, "CONFLICT", ex.getMessage(), Map.of());
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    ResponseEntity<MilestoneErrorResponse> notFound(ResourceNotFoundException ex) {
        return error(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", ex.getMessage(), Map.of());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<MilestoneErrorResponse> mismatch(MethodArgumentTypeMismatchException ex) {
        return error(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED", "Review query is invalid",
                Map.of(ex.getName(), List.of("Invalid value")));
    }

    private ResponseEntity<MilestoneErrorResponse> error(HttpStatus status, String code, String message,
                                                          Map<String, List<String>> errors) {
        return ResponseEntity.status(status).body(new MilestoneErrorResponse(status.value(), code, message,
                errors, CorrelationIdFilter.currentId(), Instant.now()));
    }
}
