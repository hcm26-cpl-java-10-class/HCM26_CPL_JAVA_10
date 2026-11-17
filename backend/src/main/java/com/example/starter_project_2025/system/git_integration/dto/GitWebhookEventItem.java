package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEventStatus;

import java.time.LocalDateTime;

/**
 * SY-04: a received webhook delivery for the operations log. Never carries the payload.
 * {@code note} is the last error, or why it was ignored / what it stored.
 */
public record GitWebhookEventItem(
        Long id,
        String deliveryId,
        String eventType,
        String action,
        String repoFullName,
        String senderLogin,
        GitWebhookEventStatus status,
        int retryCount,
        int maxRetries,
        LocalDateTime nextRetryAt,
        String note,
        LocalDateTime receivedAt,
        LocalDateTime processedAt,
        Long latencyMs,
        boolean replayable) {
}
