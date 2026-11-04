package com.example.starter_project_2025.system.project.resources.template_resources;

import com.example.starter_project_2025.system.project.resources.ResourceKind;

import java.util.List;

/** Resource of a template version, including its uploaded files. */
public record TemplateResourceView(
        Long id,
        Long templateId,
        Long templateVersionId,
        String title,
        String description,
        ResourceKind kind,
        String url,
        String category,
        Integer orderIndex,
        List<TemplateResourceFileView> files
) {
}
