package com.example.starter_project_2025.system.project.workspace.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;

@org.springframework.core.annotation.Order(org.springframework.core.Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = {WorkspaceSectionsController.class, WorkspaceMockSectionsController.class})
public class WorkspaceSectionErrors {
    public record Error(int status, String message, LocalDateTime timestamp, String correlationId) { }
    private ResponseEntity<Error> response(int status, String message) {
        return ResponseEntity.status(status).body(new Error(status, message, LocalDateTime.now(), WorkspaceCorrelation.current()));
    }
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Error> denied(AccessDeniedException exception) {
        return response(403, "Your access has changed. Reload the available sections.");
    }
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Error> status(ResponseStatusException exception) {
        return response(exception.getStatusCode().value(), exception.getReason());
    }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Error> validation(MethodArgumentNotValidException exception) {
        return response(422, exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage()).findFirst().orElse("Invalid input"));
    }
    @ExceptionHandler({org.springframework.http.converter.HttpMessageNotReadableException.class,
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Error> input(Exception exception) { return response(422, "Invalid request"); }
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Error> failed(RuntimeException exception) {
        return response(500, "The section could not be loaded. Try again.");
    }
}
