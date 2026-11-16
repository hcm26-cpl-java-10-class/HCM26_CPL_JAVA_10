package com.example.starter_project_2025.system.project.template.dto.version;

import com.example.starter_project_2025.system.project.template.domain.ProjectTemplateStatus;
import com.example.starter_project_2025.system.project.template.dto.ProjectTemplateResponse;

public record TemplateVersionListItem(
        ProjectTemplateResponse template,
        Long versionId,
        String versionLabel,
        boolean latestVersion,
        ProjectTemplateStatus templateStatus
) { }
