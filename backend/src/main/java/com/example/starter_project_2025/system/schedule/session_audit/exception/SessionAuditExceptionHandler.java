package com.example.starter_project_2025.system.schedule.session_audit.exception;

import com.example.starter_project_2025.system.schedule.session_audit.CorrelationContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * T2 — Error handler riêng của {@code session_audit} (AC T2-03, T2-05, T2-06).
 *
 * <p>Chỉ áp dụng cho controller trong package {@code session_audit} và trả mọi lỗi kèm
 * {@code correlationId} để đối chiếu error response ↔ log (NFR-OBS).</p>
 */
@Slf4j
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(basePackages = "com.example.starter_project_2025.system.schedule.session_audit")
public class SessionAuditExceptionHandler {

    @ExceptionHandler(SessionNotFoundException.class)
    public ResponseEntity<SessionAuditErrorResponse> handleNotFound(SessionNotFoundException ex) {
        log.warn("[404] Session not found: {}", ex.getMessage());
        return build(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND", ex.getMessage(), null);
    }

    @ExceptionHandler(SessionAuditValidationException.class)
    public ResponseEntity<SessionAuditErrorResponse> handleValidation(SessionAuditValidationException ex) {
        log.warn("[422] Validation failed [{}]: {}", ex.getCode(), ex.getFieldErrors());
        return build(HttpStatus.UNPROCESSABLE_ENTITY, ex.getCode(), "Validation failed", ex.getFieldErrors());
    }

    @ExceptionHandler(SessionAuditConflictException.class)
    public ResponseEntity<SessionAuditErrorResponse> handleConflict(SessionAuditConflictException ex) {
        log.warn("[409] Conflict [{}]: {}", ex.getCode(), ex.getMessage());
        return build(HttpStatus.CONFLICT, ex.getCode(), ex.getMessage(), null);
    }

    /**
     * Trainee (không nằm trong phạm vi phân công) không được xem notes/history → 403 FORBIDDEN.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<SessionAuditErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        log.warn("[403] Access denied: {}", ex.getMessage());
        return build(HttpStatus.FORBIDDEN, "FORBIDDEN",
                ex.getMessage() != null ? ex.getMessage() : "Access denied", null);
    }

    /**
     * AC T2-03 — History/audit là read-only: PUT/PATCH/DELETE trên endpoint history → 405.
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<SessionAuditErrorResponse> handleMethodNotAllowed(HttpRequestMethodNotSupportedException ex) {
        log.warn("[405] Method not allowed: {}", ex.getMessage());
        return build(HttpStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED",
                "Lịch sử/audit chỉ đọc, không hỗ trợ phương thức " + ex.getMethod() + ".", null);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<SessionAuditErrorResponse> handleUnreadableBody(HttpMessageNotReadableException ex) {
        log.warn("[400] Unreadable request body: {}", ex.getMessage());
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED",
                "Request body không hợp lệ.",
                Map.of("body", List.of("Request body không đọc được hoặc sai định dạng JSON.")));
    }

    private ResponseEntity<SessionAuditErrorResponse> build(HttpStatus status,
                                                           String code,
                                                           String message,
                                                           Map<String, List<String>> fieldErrors) {
        SessionAuditErrorResponse body = new SessionAuditErrorResponse(
                status.value(),
                code,
                message,
                fieldErrors,
                CorrelationContext.getOrCreate(),
                LocalDateTime.now());
        return ResponseEntity.status(status)
                .header(CorrelationContext.HEADER, body.correlationId())
                .body(body);
    }
}
