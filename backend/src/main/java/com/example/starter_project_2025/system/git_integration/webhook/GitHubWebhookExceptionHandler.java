package com.example.starter_project_2025.system.git_integration.webhook;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/** SY-03: minimal error bodies for GitHub; never echoes the request or internal details. */
@Slf4j
@RestControllerAdvice(assignableTypes = GitHubWebhookController.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
public class GitHubWebhookExceptionHandler {

    @ExceptionHandler(GitWebhookRejectedException.class)
    public ResponseEntity<Map<String, Object>> rejected(GitWebhookRejectedException ex) {
        return ResponseEntity.status(ex.getStatus()).body(Map.of("status", ex.getStatus().value(), "code", ex.getCode()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> unexpected(Exception ex) {
        log.error("Unexpected webhook error ({})", ex.getClass().getSimpleName(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("status", 500, "code", "GIT_WEBHOOK_ERROR"));
    }
}
