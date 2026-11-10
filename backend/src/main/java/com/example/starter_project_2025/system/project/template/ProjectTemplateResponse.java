package com.example.starter_project_2025.system.project.template;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import java.time.LocalDateTime;

public record ProjectTemplateResponse(
        Long id,
        String code,
        String name,
        String description,
        String category,
        String level,
        Integer estimatedDurationWeeks,
        Integer templateVersion,
        ProjectTemplateStatus status,
        Long lockVersion,
        TemplateTeamConstraints teamConstraints,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        boolean editable,
        boolean readOnly,
        Long parentTemplateId,
        String technologyStack,
        boolean removed
) {
    public static ProjectTemplateResponse from(ProjectTemplate template, boolean canUpdate,
            TemplateTeamConstraints teamConstraints) {
        boolean shared = template.getTenantId() == null;
        return new ProjectTemplateResponse(
                template.getId(), template.getCode(), template.getName(), template.getDescription(),
                template.getCategory(), template.getLevel(), template.getEstimatedDurationWeeks(),
                template.getTemplateVersion(), template.getStatus(), template.getLockVersion(), teamConstraints,
                template.getCreatedAt(), template.getUpdatedAt(),
                !shared && canUpdate && template.getStatus() == ProjectTemplateStatus.DRAFT,
                shared, template.getParentTemplateId(), template.getTechnologyStack(), !Boolean.TRUE.equals(template.getIsActive()));
    }
}
