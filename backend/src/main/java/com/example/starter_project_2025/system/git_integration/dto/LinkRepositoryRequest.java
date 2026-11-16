package com.example.starter_project_2025.system.git_integration.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * GI-04: link a repository to a master project. Only ids are accepted: owner,
 * name, URL and default branch are always read from GitHub, never from the client.
 *
 * @param installationId {@code git_installations.id} (internal id, as in GI-03)
 * @param externalId     GitHub's numeric repository id
 */
public record LinkRepositoryRequest(
        @NotNull(message = "Vui lòng chọn kết nối GitHub") @Positive Long installationId,
        @NotNull(message = "Vui lòng chọn repository") @Positive Long externalId) {
}
