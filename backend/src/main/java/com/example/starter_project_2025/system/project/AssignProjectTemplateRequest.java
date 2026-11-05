package com.example.starter_project_2025.system.project;

import jakarta.validation.constraints.NotNull;

/** US-10: payload of the "assign project template to DRAFT team" action. */
public record AssignProjectTemplateRequest(
        @NotNull(message = "projectTemplateId is required")
        Long projectTemplateId,
        Long versionId
) {
}
