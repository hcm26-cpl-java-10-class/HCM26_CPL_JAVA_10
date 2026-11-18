package com.example.starter_project_2025.system.project.template.content;

import com.example.starter_project_2025.system.project.ProjectMemberRole;
import java.math.BigDecimal;
import java.util.List;

public record TemplateSampleContentRequest(BigDecimal lockVersion, List<BacklogItem> backlogItems) {
    public record BacklogItem(BigDecimal id, String title, String description, ProjectMemberRole suggestedRole) {
        Long savedId() { return id == null ? null : id.longValueExact(); }
    }

}
