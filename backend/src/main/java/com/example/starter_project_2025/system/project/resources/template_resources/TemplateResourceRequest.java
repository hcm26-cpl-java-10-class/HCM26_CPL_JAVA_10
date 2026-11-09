package com.example.starter_project_2025.system.project.resources.template_resources;

import com.example.starter_project_2025.system.project.resources.ResourceKind;

/**
 * Payload used by the Resources tab of a template version.
 * <p>
 * {@code templateId} / {@code templateVersionId} are never accepted from the
 * client: both are derived from the version in the URL so a resource can not
 * be attached to a foreign template.
 */
public record TemplateResourceRequest(
        String title,
        String description,
        ResourceKind kind,
        String url,
        String category,
        Integer orderIndex
) {
}
