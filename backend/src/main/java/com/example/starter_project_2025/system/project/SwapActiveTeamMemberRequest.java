package com.example.starter_project_2025.system.project;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record SwapActiveTeamMemberRequest(
        @NotNull @Positive Long replacementMemberId,
        @Positive Long replacementTeamId,
        @Size(max = 500) String reason
) {
}
