package com.example.starter_project_2025.system.project.template.dto.content;

import com.example.starter_project_2025.system.project.ProjectMemberRole;
import com.example.starter_project_2025.system.project.template.domain.backlog.TemplateBacklogItem;
import com.example.starter_project_2025.system.project.template.domain.ProjectTemplate;
import com.example.starter_project_2025.system.project.template.domain.ProjectTemplateStatus;
import com.example.starter_project_2025.system.project.template.validation.content.TemplateSampleContentValidator;
import java.util.Arrays;
import java.util.List;

public record TemplateSampleContentResponse(Long templateId, Long lockVersion, boolean editable,
        List<BacklogItem> backlogItems, List<ProjectMemberRole> roles, int maxItems, long maxImportBytes) {
    public static TemplateSampleContentResponse from(ProjectTemplate template, List<TemplateBacklogItem> backlog,
            boolean canEdit, long maxImportBytes) {
        return new TemplateSampleContentResponse(template.getId(), template.getLockVersion(),
                canEdit && template.getStatus() == ProjectTemplateStatus.DRAFT,
                backlog.stream().map(item -> new BacklogItem(item.getId(), item.getTitle(), item.getDescription(),
                        item.getSuggestedRole(), item.getOrderIndex())).toList(),
                Arrays.asList(ProjectMemberRole.values()),
                TemplateSampleContentValidator.MAX_ITEMS, maxImportBytes);
    }

    public record BacklogItem(Long id, String title, String description, ProjectMemberRole suggestedRole, Integer orderIndex) { }
}
