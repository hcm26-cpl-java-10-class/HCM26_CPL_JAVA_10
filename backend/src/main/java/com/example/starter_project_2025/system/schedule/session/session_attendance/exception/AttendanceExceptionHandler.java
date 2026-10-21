package com.example.starter_project_2025.system.schedule.session.session_attendance.exception;

import com.example.starter_project_2025.system.schedule.session.session_attendance.AttendanceCodes;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.AttendanceErrorResponse;
import com.example.starter_project_2025.system.schedule.session_audit.CorrelationContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * T1 / mục 8 — Error handler riêng của {@code session_attendance}.
 *
 * <p>Chỉ áp dụng cho controller trong package này và trả mọi lỗi kèm {@code correlationId}
 * để client đối chiếu log (NFR-OBS). Đặt {@code HIGHEST_PRECEDENCE} để không bị
 * {@code GlobalExceptionHandler} (bắt RuntimeException → 400) xử lý trước.</p>
 */
@Slf4j
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(basePackages = "com.example.starter_project_2025.system.schedule.session.session_attendance")
public class AttendanceExceptionHandler {

    @ExceptionHandler(AttendanceNotFoundException.class)
    public ResponseEntity<AttendanceErrorResponse> handleNotFound(AttendanceNotFoundException ex) {
        log.warn("[404] {}: {}", ex.getCode(), ex.getMessage());
        return build(HttpStatus.NOT_FOUND, ex.getCode(), ex.getMessage(), null, null);
    }

    @ExceptionHandler(AttendanceValidationException.class)
    public ResponseEntity<AttendanceErrorResponse> handleValidation(AttendanceValidationException ex) {
        log.warn("[422] Validation failed [{}]: {}", ex.getCode(), ex.getFieldErrors());
        return build(HttpStatus.UNPROCESSABLE_ENTITY, ex.getCode(), ex.getMessage(),
                ex.getFieldErrors(), null);
    }

    @ExceptionHandler(AttendanceConflictException.class)
    public ResponseEntity<AttendanceErrorResponse> handleConflict(AttendanceConflictException ex) {
        log.warn("[409] Conflict [{}]: {}", ex.getCode(), ex.getMessage());
        return build(HttpStatus.CONFLICT, ex.getCode(), ex.getMessage(), null, ex.getCurrentVersion());
    }

    @ExceptionHandler(AttendanceContractUnavailableException.class)
    public ResponseEntity<AttendanceErrorResponse> handleContractUnavailable(
            AttendanceContractUnavailableException ex) {
        log.error("[503] Contract unavailable: {}", ex.getMessage());
        return build(HttpStatus.SERVICE_UNAVAILABLE, ex.getCode(), ex.getMessage(), null, null);
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<AttendanceErrorResponse> handleOptimisticLock(OptimisticLockingFailureException ex) {
        log.warn("[409] Optimistic lock failure: {}", ex.getMessage());
        return build(HttpStatus.CONFLICT, AttendanceCodes.ATTENDANCE_VERSION_CONFLICT,
                "Attendance data has changed; reload and try again.", null, null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<AttendanceErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        log.warn("[403] Access denied: {}", ex.getMessage());
        return build(HttpStatus.FORBIDDEN, AttendanceCodes.FORBIDDEN,
                ex.getMessage() != null ? ex.getMessage() : "You do not have permission to perform this action.",
                null, null);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<AttendanceErrorResponse> handleUnauthenticated(AuthenticationException ex) {
        log.warn("[401] Unauthenticated: {}", ex.getMessage());
        return build(HttpStatus.UNAUTHORIZED, AttendanceCodes.UNAUTHENTICATED,
                "Not authenticated or the session has expired.", null, null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<AttendanceErrorResponse> handleBeanValidation(MethodArgumentNotValidException ex) {
        Map<String, List<String>> fieldErrors = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.computeIfAbsent(error.getField(), key -> new java.util.ArrayList<>())
                    .add(error.getDefaultMessage());
        }
        log.warn("[422] Bean validation failed: {}", fieldErrors);
        return build(HttpStatus.UNPROCESSABLE_ENTITY, AttendanceCodes.VALIDATION_FAILED,
                "Validation failed", fieldErrors, null);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<AttendanceErrorResponse> handleUnreadableBody(HttpMessageNotReadableException ex) {
        log.warn("[400] Unreadable request body: {}", ex.getMessage());
        return build(HttpStatus.BAD_REQUEST, AttendanceCodes.BAD_REQUEST,
                "Request body is invalid or malformed JSON.",
                Map.of("body", List.of("The request body cannot be read or is not valid JSON.")), null);
    }

    @ExceptionHandler({MissingRequestHeaderException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<AttendanceErrorResponse> handleBadRequest(Exception ex) {
        log.warn("[400] Bad request: {}", ex.getMessage());
        return build(HttpStatus.BAD_REQUEST, AttendanceCodes.BAD_REQUEST, ex.getMessage(), null, null);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<AttendanceErrorResponse> handleMethodNotAllowed(HttpRequestMethodNotSupportedException ex) {
        log.warn("[405] Method not allowed: {}", ex.getMessage());
        return build(HttpStatus.METHOD_NOT_ALLOWED, AttendanceCodes.METHOD_NOT_ALLOWED,
                "Method " + ex.getMethod() + " is not supported for this endpoint.", null, null);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<AttendanceErrorResponse> handleMediaType(HttpMediaTypeNotSupportedException ex) {
        log.warn("[415] Unsupported media type: {}", ex.getMessage());
        return build(HttpStatus.UNSUPPORTED_MEDIA_TYPE, AttendanceCodes.BAD_REQUEST,
                "Unsupported Content-Type (application/json is required).", null, null);
    }

    /** Lỗi không lường trước — không lộ chi tiết hệ thống ra client. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<AttendanceErrorResponse> handleUnexpected(Exception ex) {
        log.error("[500] Unexpected error in attendance module", ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, AttendanceCodes.INTERNAL_ERROR,
                "A system error occurred; please try again later.", null, null);
    }

    private ResponseEntity<AttendanceErrorResponse> build(HttpStatus status,
                                                          String code,
                                                          String message,
                                                          Map<String, List<String>> fieldErrors,
                                                          Long currentVersion) {
        AttendanceErrorResponse body = new AttendanceErrorResponse(
                status.value(),
                code,
                message,
                fieldErrors,
                currentVersion,
                CorrelationContext.getOrCreate(),
                LocalDateTime.now());
        return ResponseEntity.status(status)
                .header(CorrelationContext.HEADER, body.correlationId())
                .body(body);
    }
}
