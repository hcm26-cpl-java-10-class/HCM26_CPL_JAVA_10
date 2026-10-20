package com.example.starter_project_2025.system.schedule.session_status.exception;

import com.example.starter_project_2025.system.schedule.exception.ApiErrorResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;

/**
 * Map {@link SessionNotFoundException} → 404 SESSION_NOT_FOUND.
 *
 * <p>Đặt {@code Ordered.HIGHEST_PRECEDENCE} để thắng {@code GlobalExceptionHandler}
 * (vốn bắt {@code RuntimeException} → 400).</p>
 */
@Slf4j
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice
public class SessionStatusExceptionHandler {

    @ExceptionHandler(SessionNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleNotFound(SessionNotFoundException ex) {
        log.warn("[404] Session not found: {}", ex.getMessage());
        ApiErrorResponse error = new ApiErrorResponse(
                HttpStatus.NOT_FOUND.value(),
                "SESSION_NOT_FOUND",
                ex.getMessage(),
                null,
                LocalDateTime.now());
        return new ResponseEntity<>(error, HttpStatus.NOT_FOUND);
    }
}
