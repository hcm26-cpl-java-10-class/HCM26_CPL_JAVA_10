package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.exception.error.ValidationErrorResponse;
import com.fasterxml.jackson.databind.JsonMappingException;
import jakarta.validation.ConstraintViolationException;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Class-specific error formatting; other modules retain their existing handlers. */
@Order(-1)
@RestControllerAdvice(assignableTypes = { TrainingClassController.class, ClassEnrollmentController.class })
public class TrainingClassExceptionHandler {
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ValidationErrorResponse> validation(ConstraintViolationException ex) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        ex.getConstraintViolations().forEach(violation -> {
            String path = violation.getPropertyPath().toString();
            int index = path.indexOf('[');
            if (index >= 0) path = path.substring(index).replace(".<list element>", "");
            errors.computeIfAbsent(path, key -> new ArrayList<>()).add(violation.getMessage());
        });
        return ResponseEntity.badRequest().body(new ValidationErrorResponse("Validation failed", errors));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ValidationErrorResponse> unreadable(HttpMessageNotReadableException ex) {
        String field = "input";
        Throwable cause = ex;
        while (cause != null) {
            if (cause instanceof JsonMappingException mapping && !mapping.getPath().isEmpty()) {
                StringBuilder path = new StringBuilder();
                for (var reference : mapping.getPath()) {
                    if (reference.getIndex() >= 0) path.append('[').append(reference.getIndex()).append(']');
                    else if (reference.getFieldName() != null) {
                        if (!path.isEmpty()) path.append('.');
                        path.append(reference.getFieldName());
                    }
                }
                field = path.toString();
                break;
            }
            cause = cause.getCause();
        }
        String message = field.endsWith("Date") ? "Use a valid date in YYYY-MM-DD format"
                : "Invalid JSON value; import expects an array of class objects with DTO field types";
        return ResponseEntity.badRequest().body(new ValidationErrorResponse("Validation failed", Map.of(field, List.of(message))));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ValidationErrorResponse> unsupportedMediaType(HttpMediaTypeNotSupportedException ex) {
        return ResponseEntity.status(415).body(new ValidationErrorResponse("Use application/json",
                Map.of("input", List.of("Import expects a JSON array, not multipart/form-data"))));
    }
}
