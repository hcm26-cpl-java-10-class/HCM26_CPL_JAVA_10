package com.example.starter_project_2025.system.project.resources.template_resources;

/**
 * Uploaded file of a template resource.
 *
 * @param downloadPath relative API path (below {@code /api}) that streams the
 *                     file back to an authorised caller
 */
public record TemplateResourceFileView(
        Long id,
        String originalName,
        String contentType,
        Long sizeBytes,
        String downloadPath
) {
}
