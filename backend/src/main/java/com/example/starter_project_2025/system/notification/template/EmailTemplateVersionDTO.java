package com.example.starter_project_2025.system.notification.template;

import java.time.LocalDateTime;

public record EmailTemplateVersionDTO(
        Long id,
        Long templateId,
        int version,
        String subjectTemplate,
        String bodyHtml,
        String changeNote,
        Long createdByUserId,
        LocalDateTime createdAt
) {
    public static EmailTemplateVersionDTO from(EmailTemplateVersion v) {
        return new EmailTemplateVersionDTO(
                v.getId(),
                v.getTemplateId(),
                v.getVersion(),
                v.getSubjectTemplate(),
                v.getBodyHtml(),
                v.getChangeNote(),
                v.getCreatedByUserId(),
                v.getCreatedAt()
        );
    }
}
