package com.example.starter_project_2025.system.project.aiassistant.dto.response.output;

import java.util.List;

public record GeneratedTemplateOutput(
        ProjectTemplateOutput projectTemplate,
        TeamConstraintsOutput teamConstraints,
        List<MilestoneOutput> milestones,
        List<BacklogItemOutput> backlogItems,
        List<ModuleOutput> modules,
        List<ResourceOutput> resources
) {
}
