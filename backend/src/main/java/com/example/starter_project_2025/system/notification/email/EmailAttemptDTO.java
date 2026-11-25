package com.example.starter_project_2025.system.notification.email;

import com.example.starter_project_2025.system.notification.NotificationCategory;

import java.time.LocalDateTime;

public record EmailAttemptDTO(
        Long id,
        Long tenantId,
        String idempotencyKey,
        String batchId,
        Long recipientUserId,
        String recipientEmail,
        NotificationCategory category,
        String templateCode,
        Integer templateVersion,
        String contextRef,
        String subject,
        String renderedBodyHtml,
        EmailDeliveryStatus deliveryStatus,
        int retryCount,
        int maxRetries,
        LocalDateTime nextRetryAt,
        LocalDateTime sentAt,
        String lastError,
        String correlationId,
        Long createdByUserId,
        LocalDateTime createdAt
) {
    public static EmailAttemptDTO from(EmailAttempt a, boolean includeBody) {
        return new EmailAttemptDTO(
                a.getId(),
                a.getTenantId(),
                a.getIdempotencyKey(),
                a.getBatchId(),
                a.getRecipientUserId(),
                a.getRecipientEmail(),
                a.getCategory(),
                a.getTemplateCode(),
                a.getTemplateVersion(),
                a.getContextRef(),
                a.getSubject(),
                includeBody ? a.getRenderedBodyHtml() : null,
                a.getDeliveryStatus(),
                a.getRetryCount(),
                a.getMaxRetries(),
                a.getNextRetryAt(),
                a.getSentAt(),
                a.getLastError(),
                a.getCorrelationId(),
                a.getCreatedByUserId(),
                a.getCreatedAt()
        );
    }
}
