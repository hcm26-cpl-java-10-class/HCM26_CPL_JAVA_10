package com.example.starter_project_2025.system.git_integration.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * GI-05: unlink the project's repository. {@code repositoryId} ({@code git_repositories.id}) is the
 * connection the user saw: when the project's repository changed meanwhile, nothing is unlinked.
 */
public record UnlinkRepositoryRequest(
        @NotNull(message = "Vui lòng chọn repository") @Positive Long repositoryId) {
}
