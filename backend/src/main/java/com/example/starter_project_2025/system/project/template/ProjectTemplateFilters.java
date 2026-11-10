package com.example.starter_project_2025.system.project.template;

import java.util.List;
import java.util.Objects;

public record ProjectTemplateFilters(List<ProjectTemplateStatus> statuses, List<String> levels, List<String> categories) {
    public ProjectTemplateFilters {
        statuses = statuses == null ? List.of() : statuses.stream().filter(Objects::nonNull).toList();
        levels = clean(levels);
        categories = clean(categories);
    }

    private static List<String> clean(List<String> values) {
        return values == null ? List.of() : values.stream().map(String::strip).filter(value -> !value.isEmpty()).toList();
    }
}
