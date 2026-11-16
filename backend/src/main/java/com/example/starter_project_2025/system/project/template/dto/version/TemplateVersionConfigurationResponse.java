package com.example.starter_project_2025.system.project.template.dto.version;

import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotDTO;
import com.example.starter_project_2025.system.project.template.dto.content.TemplateSampleContentResponse;
import com.example.starter_project_2025.system.project.template.dto.milestone.TemplateMilestonePlanResponse;
import com.example.starter_project_2025.system.project.template.dto.ProjectTemplateResponse;

public record TemplateVersionConfigurationResponse(ProjectTemplateSnapshotDTO version,
        ProjectTemplateResponse template, TemplateMilestonePlanResponse milestones,
        TemplateSampleContentResponse sampleContent, boolean editable, boolean canPublish, boolean legacyContent) {
}
