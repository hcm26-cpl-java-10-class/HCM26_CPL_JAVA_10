package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(basePackageClasses = SessionController.class)
public class SessionExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(ResourceNotFoundException ex, HttpServletRequest request) {
        return error(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND", ex.getMessage(), request);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> handleUnauthenticated(AuthenticationException ex, HttpServletRequest request) {
        return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Authentication is required.", request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleForbidden(AccessDeniedException ex, HttpServletRequest request) {
        return error(HttpStatus.FORBIDDEN, "FORBIDDEN", "You cannot read this session.", request);
    }

    @ExceptionHandler({BadRequestException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ApiError> handleInvalidRequest(Exception ex, HttpServletRequest request) {
        return error(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Session ID must be a positive number.", request);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> handleUnavailable(ResponseStatusException ex, HttpServletRequest request) {
        if (ex.getStatusCode().value() == HttpStatus.SERVICE_UNAVAILABLE.value()) {
            return error(HttpStatus.SERVICE_UNAVAILABLE, "SESSION_CONTEXT_UNAVAILABLE", ex.getReason(), request);
        }
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "SESSION_READ_FAILED", "Cannot read the session.", request);
    }

    private ResponseEntity<ApiError> error(
            HttpStatus status, String code, String message, HttpServletRequest request) {
        String correlationId = request.getHeader("X-Correlation-ID");
        if (correlationId == null || !correlationId.matches("[A-Za-z0-9._-]{1,128}")) {
            correlationId = UUID.randomUUID().toString();
        }
        log.warn("Session read error: code={}, correlationId={}", code, correlationId);
        return ResponseEntity.status(status)
                .header("X-Correlation-ID", correlationId)
                .body(new ApiError(code, message, Map.of(), correlationId));
    }

    public record ApiError(
            String code, String message, Map<String, List<String>> fieldErrors, String correlationId) {}
}
