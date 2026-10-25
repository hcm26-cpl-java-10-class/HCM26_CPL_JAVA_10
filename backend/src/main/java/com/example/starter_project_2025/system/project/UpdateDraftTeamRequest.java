package com.example.starter_project_2025.system.project;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

public record UpdateDraftTeamRequest(
        @NotBlank
        @Size(max = 255)
        String teamName,

        @Positive
        Long assignedMentorId,

        @Valid
        List<MemberRequest> members
) {
    public record MemberRequest(
            @NotNull
            @Positive
            Long memberId,

            @Size(max = 30)
            String role
    ) {
    }
}
