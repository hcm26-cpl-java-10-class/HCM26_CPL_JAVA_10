package com.example.starter_project_2025.system.project.template.version;

import com.example.starter_project_2025.system.project.template.ProjectTemplateResponse;
import com.example.starter_project_2025.system.project.template.ProjectTemplateStatus;

public record TemplateVersionListItem(
        ProjectTemplateResponse template,
        Long versionId,
        String versionLabel,
        boolean latestVersion,
        ProjectTemplateStatus templateStatus
) { }
