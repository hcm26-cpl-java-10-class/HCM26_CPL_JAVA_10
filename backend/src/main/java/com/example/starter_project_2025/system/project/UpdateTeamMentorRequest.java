package com.example.starter_project_2025.system.project;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record UpdateTeamMentorRequest(
        @Positive Long assignedMentorId,
        @Size(max = 500)
        String reason
) {
}
