package com.example.starter_project_2025.system.notification.email;

import com.example.starter_project_2025.system.notification.NotificationCategory;

import java.util.List;
import java.util.Map;

public record EmailSendRequest(
        Long templateId,
        String subject,
        String bodyHtml,
        NotificationCategory category,
        String contextRef,
        Long classId,
        List<Long> recipientUserIds,
        List<String> recipientEmails,
        Map<String, Object> variables,
        String idempotencyKey,
        Boolean respectPreference
) {
    public record BatchItemResult(
            String recipientEmail,
            Long recipientUserId,
            Long attemptId,
            String status,
            String reason
    ) {
    }

    public record BatchResult(
            String batchId,
            String idempotencyKey,
            boolean duplicateRequest,
            int total,
            int queuedCount,
            int skippedCount,
            int failedCount,
            List<BatchItemResult> items
    ) {
    }
}
