package com.example.starter_project_2025.system.project;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record TransferActiveTeamMemberRequest(
        @NotNull @Positive Long destinationTeamId,
        @NotNull Long sourceTeamVersion,
        @NotNull Long destinationTeamVersion,
        @NotBlank @Size(max = 500) String reason
) {
}
