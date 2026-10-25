package com.example.starter_project_2025.system.project.milestone.exception;

import lombok.Getter;

import java.util.List;
import java.util.Map;

@Getter
public class MilestoneValidationException extends RuntimeException {
    private final Map<String, List<String>> errors;

    public MilestoneValidationException(Map<String, List<String>> errors) {
        super("Milestone validation failed");
        this.errors = errors;
    }
}
