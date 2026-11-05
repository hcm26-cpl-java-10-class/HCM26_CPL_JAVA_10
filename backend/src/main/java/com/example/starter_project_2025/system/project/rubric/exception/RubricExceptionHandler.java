package com.example.starter_project_2025.system.project.rubric.exception;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.rubric.controller.RubricController;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.*;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@RestControllerAdvice(assignableTypes = RubricController.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RubricExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<RubricErrorResponse> invalid(MethodArgumentNotValidException ex) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            errors.computeIfAbsent(error.getField(), ignored -> new ArrayList<>()).add(error.getDefaultMessage());
        }
        return response(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED", "Rubric data is invalid", errors);
    }

    @ExceptionHandler(RubricValidationException.class)
    ResponseEntity<RubricErrorResponse> invalid(RubricValidationException ex) {
        return response(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED", "Rubric data is invalid", ex.getErrors());
    }

    @ExceptionHandler({RubricConflictException.class, OptimisticLockingFailureException.class})
    ResponseEntity<RubricErrorResponse> conflict(RuntimeException ex) {
        return response(HttpStatus.CONFLICT, "CONFLICT", ex.getMessage(), Map.of());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<RubricErrorResponse> constraintConflict(DataIntegrityViolationException ex) {
        return response(HttpStatus.CONFLICT, "CONFLICT", "Rubric data conflicts with an existing value", Map.of());
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    ResponseEntity<RubricErrorResponse> notFound(ResourceNotFoundException ex) {
        return response(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", ex.getMessage(), Map.of());
    }

    private ResponseEntity<RubricErrorResponse> response(HttpStatus status, String code, String message,
                                                          Map<String, List<String>> errors) {
        return ResponseEntity.status(status).body(new RubricErrorResponse(status.value(), code, message, errors, Instant.now()));
    }
}
