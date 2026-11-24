package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/** TM-03: link a pull request of the task's repository to the task by its number. Only PULL_REQUEST for now. */
public record LinkPullRequestRequest(
        @NotNull GitArtifactType type,
        @NotNull @Min(1) Integer number) {
}
