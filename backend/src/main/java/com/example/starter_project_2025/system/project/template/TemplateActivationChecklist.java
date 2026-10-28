package com.example.starter_project_2025.system.project.template;

import java.util.List;
import java.util.Map;

public record TemplateActivationChecklist(
        Long templateId,
        Long lockVersion,
        ProjectTemplateStatus status,
        boolean ready,
        boolean canActivate,
        List<Item> items
) {
    public record Item(String section, String label, boolean passed, Map<String, List<String>> errors) {
    }
}
