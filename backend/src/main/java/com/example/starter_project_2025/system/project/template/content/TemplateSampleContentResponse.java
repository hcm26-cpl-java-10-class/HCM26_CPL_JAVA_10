package com.example.starter_project_2025.system.project.template.content;

import com.example.starter_project_2025.system.project.ProjectMemberRole;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.milestone.submission.service.ArtifactMimePolicy;
import com.example.starter_project_2025.system.project.template.ProjectTemplateStatus;
import com.example.starter_project_2025.system.project.template.artifact.*;
import com.example.starter_project_2025.system.project.template.backlog.TemplateBacklogItem;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestone;
import java.util.Arrays;
import java.util.List;

public record TemplateSampleContentResponse(Long templateId, Long lockVersion, boolean editable,
        List<BacklogItem> backlogItems, List<Artifact> artifacts, List<MilestoneOption> milestones,
        List<ProjectMemberRole> roles, List<String> supportedMimeTypes, int maxItems, long maxImportBytes) {
    public static TemplateSampleContentResponse from(ProjectTemplate template, List<TemplateBacklogItem> backlog,
            List<TemplateArtifactRequirement> artifacts, List<TemplateMilestone> milestones, boolean canEdit, long maxImportBytes) {
        return new TemplateSampleContentResponse(template.getId(), template.getLockVersion(),
                canEdit && template.getStatus() == ProjectTemplateStatus.DRAFT,
                backlog.stream().map(item -> new BacklogItem(item.getId(), item.getTitle(), item.getDescription(),
                        item.getSuggestedRole(), item.getOrderIndex())).toList(),
                artifacts.stream().map(item -> new Artifact(item.getId(), item.getMilestone().getId(), item.getTitle(),
                        item.getDescription(), item.getType(), item.getAllowedMimeTypes().stream().sorted().toList(), item.getOrderIndex())).toList(),
                milestones.stream().map(item -> new MilestoneOption(item.getId(), item.getTitle(), item.getOrderIndex())).toList(),
                Arrays.asList(ProjectMemberRole.values()), ArtifactMimePolicy.SUPPORTED_TYPES.stream().sorted().toList(),
                TemplateSampleContentValidator.MAX_ITEMS, maxImportBytes);
    }

    public record BacklogItem(Long id, String title, String description, ProjectMemberRole suggestedRole, Integer orderIndex) { }
    public record Artifact(Long id, Long milestoneId, String title, String description, TemplateArtifactType type,
                           List<String> allowedMimeTypes, Integer orderIndex) { }
    public record MilestoneOption(Long id, String title, Integer orderIndex) { }
}
