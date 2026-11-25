package com.example.starter_project_2025.system.project;

import java.time.LocalDateTime;

/**
 * US-10 error body for the project-template assignment rules. Kept separate from
 * {@link TeamErrorResponse} because the UI needs the capacity window and the
 * current team size to render an actionable message.
 */
public record TeamTemplateErrorResponse(
        int status,
        String errorCode,
        String reason,
        String message,
        Long teamId,
        Long projectTemplateId,
        String projectTemplateName,
        Integer memberCount,
        Integer minMembers,
        Integer maxMembers,
        LocalDateTime timestamp
) {
}
