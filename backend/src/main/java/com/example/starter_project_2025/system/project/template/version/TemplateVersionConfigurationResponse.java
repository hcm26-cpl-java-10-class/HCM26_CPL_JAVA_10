package com.example.starter_project_2025.system.project.template.version;

import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotDTO;
import com.example.starter_project_2025.system.project.template.ProjectTemplateResponse;
import com.example.starter_project_2025.system.project.template.content.TemplateSampleContentResponse;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestonePlanResponse;

public record TemplateVersionConfigurationResponse(ProjectTemplateSnapshotDTO version,
        ProjectTemplateResponse template, TemplateMilestonePlanResponse milestones,
        TemplateSampleContentResponse sampleContent, boolean editable, boolean canPublish, boolean legacyContent) {
}
