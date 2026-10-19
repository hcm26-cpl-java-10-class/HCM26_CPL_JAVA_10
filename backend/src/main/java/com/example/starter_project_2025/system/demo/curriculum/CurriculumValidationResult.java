package com.example.starter_project_2025.system.demo.curriculum;

import java.util.List;

public record CurriculumValidationResult(
        boolean valid,
        List<Issue> errors
) {

    public static CurriculumValidationResult of(List<Issue> errors) {
        return new CurriculumValidationResult(errors.isEmpty(), List.copyOf(errors));
    }

    public record Issue(String code, Long sectionId, Long lessonId, String message) {
    }
}