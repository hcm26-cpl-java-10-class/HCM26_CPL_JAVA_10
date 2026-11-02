package com.example.starter_project_2025.system.project.template.resources;

import com.example.starter_project_2025.system.project.template.ProjectTemplateException;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = TemplateResourceController.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TemplateResourceErrors {
    public record Error(int status, String message, Map<String, List<String>> errors, LocalDateTime timestamp, String correlationId) { }

    @ExceptionHandler(ProjectTemplateException.class)
    public ResponseEntity<Error> validation(ProjectTemplateException exception) {
        return error(exception.getStatus(), exception.getMessage(), exception.getErrors());
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Error> status(ResponseStatusException exception) {
        return error(exception.getStatusCode().value(), exception.getReason(), Map.of());
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Error> denied(AccessDeniedException exception) {
        return error(403, "You do not have access to this template resource", Map.of());
    }

    @ExceptionHandler({org.springframework.web.bind.MissingServletRequestParameterException.class,
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class,
            org.springframework.http.converter.HttpMessageNotReadableException.class})
    public ResponseEntity<Error> input(Exception exception) {
        return error(422, "Invalid resource request", Map.of());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Error> failed(Exception exception) {
        return error(500, "The resource request could not be completed. Please try again.", Map.of());
    }

    private ResponseEntity<Error> error(int status, String message, Map<String, List<String>> errors) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore())
                .body(new Error(status, message, errors, LocalDateTime.now(), CorrelationIdFilter.currentId()));
    }
}
