package com.example.starter_project_2025.system.project.template;

import java.util.List;

public record ProjectTemplateOptions(
        Long tenantId,
        String tenantName,
        List<String> categories,
        boolean canCreate,
        boolean canUpdate,
        boolean canActivate,
        boolean canArchive
) {
}
