package com.example.starter_project_2025.system.project;

/**
 * US-10: the project template currently attached to a team, plus the live team
 * size so the client can render the capacity check without another request.
 */
public record TeamProjectTemplateResponse(
        Long teamId,
        String teamName,
        ProjectTeamStatus teamStatus,
        Long classId,
        String className,
        Long projectTemplateId,
        String projectTemplateName,
        Integer minMembers,
        Integer maxMembers,
        int memberCount
) {
}
