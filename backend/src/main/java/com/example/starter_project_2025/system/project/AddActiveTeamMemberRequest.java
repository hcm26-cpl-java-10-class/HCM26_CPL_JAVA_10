package com.example.starter_project_2025.system.project;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record AddActiveTeamMemberRequest(
        @NotNull @Positive Long memberId
) {
}
