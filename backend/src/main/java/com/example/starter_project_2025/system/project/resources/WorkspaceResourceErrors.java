package com.example.starter_project_2025.system.project.resources;

import com.example.starter_project_2025.system.project.workspace.controller.WorkspaceCorrelation;
import java.time.LocalDateTime;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = WorkspaceResourceController.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
public class WorkspaceResourceErrors {
    public record Error(int status, String code, String message, LocalDateTime timestamp, String correlationId) { }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Error> denied(AccessDeniedException exception) {
        return error(403, "RESOURCE_ACCESS_DENIED", exception.getMessage());
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Error> status(ResponseStatusException exception) {
        int status = exception.getStatusCode().value();
        return error(status, status == 403 ? "RESOURCE_DOWNLOAD_LINK_INVALID" : "RESOURCE_UNAVAILABLE", exception.getReason());
    }

    @ExceptionHandler({MissingServletRequestParameterException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Error> invalid(Exception exception) {
        return error(422, "INVALID_RESOURCE_REQUEST", "Invalid resource download request");
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Error> failed(RuntimeException exception) {
        return error(500, "RESOURCE_LOAD_FAILED", "Project resources could not be loaded. Please try again.");
    }

    private ResponseEntity<Error> error(int status, String code, String message) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore())
                .body(new Error(status, code, message, LocalDateTime.now(), WorkspaceCorrelation.current()));
    }
}
