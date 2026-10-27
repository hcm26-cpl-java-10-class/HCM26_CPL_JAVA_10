package com.example.starter_project_2025.system.project.template;

import java.util.List;
import java.util.Map;
import lombok.Getter;

@Getter
public class ProjectTemplateException extends RuntimeException {
    private final int status;
    private final Map<String, List<String>> errors;

    public ProjectTemplateException(int status, String message, Map<String, List<String>> errors) {
        super(message);
        this.status = status;
        this.errors = errors;
    }

    public static ProjectTemplateException duplicateCode() {
        String message = "Template code already exists for this version in your tenant";
        return new ProjectTemplateException(409, message, Map.of("code", List.of(message)));
    }

    public static ProjectTemplateException conflict(String message) {
        return new ProjectTemplateException(409, message, Map.of());
    }
}
