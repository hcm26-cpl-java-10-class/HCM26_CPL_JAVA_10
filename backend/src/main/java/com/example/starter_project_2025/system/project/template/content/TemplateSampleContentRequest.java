package com.example.starter_project_2025.system.project.template.content;

import com.example.starter_project_2025.system.project.ProjectMemberRole;
import com.example.starter_project_2025.system.project.template.artifact.TemplateArtifactType;
import java.math.BigDecimal;
import java.util.List;

public record TemplateSampleContentRequest(BigDecimal lockVersion, List<BacklogItem> backlogItems, List<Artifact> artifacts) {
    public record BacklogItem(BigDecimal id, String title, String description, ProjectMemberRole suggestedRole) {
        Long savedId() { return id == null ? null : id.longValueExact(); }
    }

    public record Artifact(BigDecimal id, BigDecimal milestoneId, String title, String description,
                           TemplateArtifactType type, List<String> allowedMimeTypes) {
        Long savedId() { return id == null ? null : id.longValueExact(); }
        Long savedMilestoneId() { return milestoneId.longValueExact(); }
    }
}
