package com.example.starter_project_2025.system.project.rubric.exception;

import lombok.Getter;
import java.util.List;
import java.util.Map;

@Getter
public class RubricValidationException extends RuntimeException {
    private final Map<String, List<String>> errors;
    public RubricValidationException(Map<String, List<String>> errors) {
        super("Rubric validation failed");
        this.errors = errors;
    }
}
