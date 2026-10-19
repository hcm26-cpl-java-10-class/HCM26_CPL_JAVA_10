package com.example.starter_project_2025.system.schedule.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;

/**
 * Exception handler cho module schedule/session (F15).
 *
 * <p>Đặt {@code @Order(HIGHEST_PRECEDENCE)} để các handler cụ thể ở đây được ưu tiên hơn
 * {@code GlobalExceptionHandler} (vốn bắt {@code RuntimeException} → 400), nhờ đó trả đúng
 * 409 / 422 theo đặc tả.</p>
 */
@Slf4j
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice
public class SessionExceptionHandler {

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ApiErrorResponse> handleConflict(ConflictException ex) {
        log.warn("[409] Conflict [{}]: {}", ex.getCode(), ex.getMessage());
        ApiErrorResponse error = new ApiErrorResponse(
                HttpStatus.CONFLICT.value(),
                ex.getCode(),
                ex.getMessage(),
                null,
                LocalDateTime.now());
        return new ResponseEntity<>(error, HttpStatus.CONFLICT);
    }

    @ExceptionHandler(UnprocessableEntityException.class)
    public ResponseEntity<ApiErrorResponse> handleUnprocessable(UnprocessableEntityException ex) {
        log.warn("[422] Unprocessable [{}]: {}", ex.getCode(), ex.getMessage());
        ApiErrorResponse error = new ApiErrorResponse(
                HttpStatus.UNPROCESSABLE_ENTITY.value(),
                ex.getCode(),
                ex.getMessage(),
                ex.getFieldErrors(),
                LocalDateTime.now());
        return new ResponseEntity<>(error, HttpStatus.UNPROCESSABLE_ENTITY);
    }
}
