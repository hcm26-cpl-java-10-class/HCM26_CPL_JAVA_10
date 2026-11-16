package com.example.starter_project_2025.system.git_integration.exception;

import com.example.starter_project_2025.system.git_integration.controller.GitInstallationController;
import com.example.starter_project_2025.system.git_integration.dto.GitIntegrationErrorResponse;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

/**
 * Error mapping for Git Integration endpoints. Runs before the global handler,
 * which echoes raw exception messages to clients, so nothing from GitHub or
 * from secrets can leak through an unexpected error.
 */
@Slf4j
@RestControllerAdvice(assignableTypes = GitInstallationController.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
public class GitIntegrationExceptionHandler {

    @ExceptionHandler(GitIntegrationException.class)
    public ResponseEntity<GitIntegrationErrorResponse> business(GitIntegrationException ex) {
        var builder = ResponseEntity.status(ex.getStatus());
        if (ex.getRetryAfterSeconds() != null) {
            builder.header("Retry-After", String.valueOf(ex.getRetryAfterSeconds()));
        }
        return builder.body(new GitIntegrationErrorResponse(ex.getStatus().value(), ex.getCode(), ex.getMessage(),
                LocalDateTime.now(), CorrelationIdFilter.currentId(), ex.getRetryAfterSeconds(), ex.getInstallationStatus()));
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<GitIntegrationErrorResponse> unauthenticated(AuthenticationException ex) {
        return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Vui lòng đăng nhập");
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<GitIntegrationErrorResponse> forbidden(AccessDeniedException ex) {
        return error(HttpStatus.FORBIDDEN, "GIT_INTEGRATION_FORBIDDEN",
                "Bạn không có quyền truy cập Git Integration");
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<GitIntegrationErrorResponse> status(ResponseStatusException ex) {
        HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
        if (status == null) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }
        return error(status, status.name(), status.getReasonPhrase());
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<GitIntegrationErrorResponse> invalidBody(Exception ex) {
        return error(HttpStatus.BAD_REQUEST, "GIT_CALLBACK_INVALID", "Dữ liệu callback không hợp lệ");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<GitIntegrationErrorResponse> unexpected(Exception ex) {
        log.error("Unexpected Git Integration error ({})", ex.getClass().getSimpleName(), ex);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "GIT_INTEGRATION_ERROR",
                "Đã xảy ra lỗi khi xử lý kết nối GitHub");
    }

    private static ResponseEntity<GitIntegrationErrorResponse> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(new GitIntegrationErrorResponse(
                status.value(), code, message, LocalDateTime.now(), CorrelationIdFilter.currentId()));
    }
}
