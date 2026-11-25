package com.example.starter_project_2025.system.notification.template;

import com.example.starter_project_2025.system.notification.NotificationCategory;

import java.util.Map;

public record EmailTemplateUpsertRequest(
        String code,
        String name,
        NotificationCategory category,
        String description,
        String subjectTemplate,
        String bodyHtml,
        String sampleVariablesJson,
        String changeNote
) {
    public record PreviewRequest(
            Long templateId,
            String subjectTemplate,
            String bodyHtml,
            Map<String, Object> variables
    ) {
    }

    public record PreviewResponse(
            String renderedSubject,
            String renderedBodyHtml
    ) {
    }

    public record StatusRequest(boolean active) {
    }
}
