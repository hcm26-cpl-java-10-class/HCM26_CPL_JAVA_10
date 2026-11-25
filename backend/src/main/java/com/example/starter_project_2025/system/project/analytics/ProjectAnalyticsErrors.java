package com.example.starter_project_2025.system.project.analytics;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * US-ANL-002 AC04: error contract of the Analytics data collection endpoint.
 *
 * <p>Analytics filters are rejected with HTTP 422 (never 400) and a body of
 * {@code { status, message, errors: { <query param>: [<message>] } }} so the
 * filter bar can highlight the offending control. Scoped to
 * {@link ProjectAnalyticsController} so the generic application wide handler
 * keeps its 400 behaviour for every other endpoint.</p>
 */
@Slf4j
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = ProjectAnalyticsController.class)
public class ProjectAnalyticsErrors {

    private static final String INVALID_FILTERS = "The analytics filters are not valid";

    @ExceptionHandler(ProjectAnalyticsValidationException.class)
    public ResponseEntity<Map<String, Object>> rejected(ProjectAnalyticsValidationException error) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        errors.put(error.getField(), List.of(error.getMessage()));
        return response(HttpStatus.UNPROCESSABLE_ENTITY, INVALID_FILTERS, errors);
    }

    /**
     * Type / format failures while binding the query parameters, e.g.
     * {@code sprintId=abc} or {@code startDate=2026-13-45}.
     */
    @ExceptionHandler({BindException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Map<String, Object>> unreadable(Exception error) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        if (error instanceof BindException binding) {
            for (FieldError fieldError : binding.getBindingResult().getFieldErrors()) {
                String message = fieldError.getDefaultMessage() == null
                        ? "This value is not valid" : fieldError.getDefaultMessage();
                errors.computeIfAbsent(fieldError.getField(), key -> new ArrayList<>()).add(message);
            }
        } else if (error instanceof MethodArgumentTypeMismatchException mismatch) {
            errors.put(mismatch.getName(), List.of("This value is not valid"));
        }
        if (errors.isEmpty()) {
            errors.put("filters", List.of("This value is not valid"));
        }
        return response(HttpStatus.UNPROCESSABLE_ENTITY, INVALID_FILTERS, errors);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> status(ResponseStatusException error) {
        return response(HttpStatus.valueOf(error.getStatusCode().value()), error.getReason(), Map.of());
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> denied(AccessDeniedException error) {
        return response(HttpStatus.FORBIDDEN, error.getMessage(), Map.of());
    }

    @ExceptionHandler(AuthenticationCredentialsNotFoundException.class)
    public ResponseEntity<Map<String, Object>> unauthenticated(Exception error) {
        return response(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ", Map.of());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> failed(Exception error) {
        log.error("Project analytics request failed", error);
        return response(HttpStatus.INTERNAL_SERVER_ERROR,
                "The analytics data could not be loaded; please try again", Map.of());
    }

    private ResponseEntity<Map<String, Object>> response(HttpStatus status, String message,
                                                         Map<String, List<String>> errors) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", status.value());
        body.put("message", message == null ? "The analytics request could not be processed" : message);
        body.put("errors", errors);
        return ResponseEntity.status(status).body(body);
    }
}
