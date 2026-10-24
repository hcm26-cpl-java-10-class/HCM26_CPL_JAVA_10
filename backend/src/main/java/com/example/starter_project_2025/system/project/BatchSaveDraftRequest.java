package com.example.starter_project_2025.system.project;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.List;

public record BatchSaveDraftRequest(
        @NotEmpty(message = "At least one team is required")
        @Valid
        List<TeamDraftRequest> teams
) {
    public record TeamDraftRequest(
            @NotBlank(message = "Team name is required")
            @Size(max = 255, message = "Team name must not exceed 255 characters")
            String teamName,

            @Positive(message = "assignedMentorId must be positive")
            Long assignedMentorId,

            @NotEmpty(message = "Each team must have at least one member")
            @Valid
            List<MemberAssignmentRequest> members
    ) {
    }

    public record MemberAssignmentRequest(
            @NotNull
            @Positive
            Long memberId,

            @Size(max = 30)
            String role
    ) {
    }
}