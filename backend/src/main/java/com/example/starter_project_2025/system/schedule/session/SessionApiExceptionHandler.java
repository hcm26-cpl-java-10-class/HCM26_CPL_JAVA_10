package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(basePackageClasses = SessionController.class)
public class SessionApiExceptionHandler {

    @ExceptionHandler(SessionRequestException.class)
    public ResponseEntity<ApiError> handleSessionRequest(SessionRequestException ex, HttpServletRequest request) {
        return error(ex.getStatus(), ex.getCode(), ex.getMessage(), ex.getFieldErrors(), request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(field -> errors
                .computeIfAbsent(field.getField(), key -> new ArrayList<>()).add(field.getDefaultMessage()));
        return error(HttpStatus.UNPROCESSABLE_ENTITY, "SESSION_VALIDATION_FAILED",
                "Session data is invalid.", errors, request);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleMalformedBody(HttpMessageNotReadableException ex, HttpServletRequest request) {
        return error(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Request body is invalid.", request);
    }

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
        return error(HttpStatus.FORBIDDEN, "FORBIDDEN", "You cannot access this session or calendar version.", request);
    }

    @ExceptionHandler({BadRequestException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ApiError> handleInvalidRequest(Exception ex, HttpServletRequest request) {
        return error(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "ID must be a positive number.", request);
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
        return error(status, code, message, Map.of(), request);
    }

    private ResponseEntity<ApiError> error(
            HttpStatus status, String code, String message, Map<String, List<String>> fieldErrors,
            HttpServletRequest request) {
        String correlationId = request.getHeader("X-Correlation-ID");
        if (correlationId == null || !correlationId.matches("[A-Za-z0-9._-]{1,128}")) {
            correlationId = UUID.randomUUID().toString();
        }
        log.warn("Session read error: code={}, correlationId={}", code, correlationId);
        return ResponseEntity.status(status)
                .header("X-Correlation-ID", correlationId)
                .body(new ApiError(code, message, fieldErrors, correlationId));
    }

    public record ApiError(
            String code, String message, Map<String, List<String>> fieldErrors, String correlationId) {}
}
