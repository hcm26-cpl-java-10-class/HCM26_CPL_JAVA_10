package com.example.starter_project_2025.system.notification.template;

import com.example.starter_project_2025.system.notification.NotificationCategory;

import java.time.LocalDateTime;

public record EmailTemplateDTO(
        Long id,
        Long tenantId,
        String code,
        String name,
        NotificationCategory category,
        String description,
        boolean active,
        int currentVersion,
        String subjectTemplate,
        String bodyHtml,
        String sampleVariablesJson,
        boolean systemSeeded,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static EmailTemplateDTO from(EmailTemplate t) {
        return new EmailTemplateDTO(
                t.getId(),
                t.getTenantId(),
                t.getCode(),
                t.getName(),
                t.getCategory(),
                t.getDescription(),
                t.isActive(),
                t.getCurrentVersion(),
                t.getSubjectTemplate(),
                t.getBodyHtml(),
                t.getSampleVariablesJson(),
                t.isSystemSeeded(),
                t.getCreatedAt(),
                t.getUpdatedAt()
        );
    }
}
