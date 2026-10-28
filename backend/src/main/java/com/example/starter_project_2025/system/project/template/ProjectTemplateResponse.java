package com.example.starter_project_2025.system.project.template;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import java.time.LocalDateTime;

public record ProjectTemplateResponse(
        Long id,
        String code,
        String name,
        String description,
        String category,
        ProjectTemplateLevel level,
        Integer estimatedDurationWeeks,
        Integer templateVersion,
        ProjectTemplateStatus status,
        Long lockVersion,
        TemplateTeamConstraints teamConstraints,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        boolean editable,
        boolean readOnly
) {
    public static ProjectTemplateResponse from(ProjectTemplate template, boolean canUpdate,
            TemplateTeamConstraints teamConstraints) {
        // tenant_id == null marks the shared catalogue (sample/demo templates):
        // every tenant can read it, nobody can mutate it.
        boolean shared = template.getTenantId() == null;
        return new ProjectTemplateResponse(
                template.getId(), template.getCode(), template.getName(), template.getDescription(),
                template.getCategory(), template.getLevel(), template.getEstimatedDurationWeeks(),
                template.getTemplateVersion(), template.getStatus(), template.getLockVersion(), teamConstraints,
                template.getCreatedAt(), template.getUpdatedAt(),
                !shared && canUpdate && template.getStatus() == ProjectTemplateStatus.DRAFT,
                shared);
    }
}
