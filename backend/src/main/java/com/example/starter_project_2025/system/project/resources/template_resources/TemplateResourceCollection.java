package com.example.starter_project_2025.system.project.resources.template_resources;

import java.util.List;

/**
 * Resources of one template version plus the upload policy, so the Resources
 * tab can validate a file before sending it.
 */
public record TemplateResourceCollection(
        List<TemplateResourceView> items,
        long maxFileBytes,
        List<String> allowedExtensions,
        boolean editable
) {
}
