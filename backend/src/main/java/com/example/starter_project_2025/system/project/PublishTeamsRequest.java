package com.example.starter_project_2025.system.project;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.List;

public record PublishTeamsRequest(
        @NotEmpty(message = "At least one team ID is required")
        List<@NotNull @Positive Long> teamIds
) {
}
