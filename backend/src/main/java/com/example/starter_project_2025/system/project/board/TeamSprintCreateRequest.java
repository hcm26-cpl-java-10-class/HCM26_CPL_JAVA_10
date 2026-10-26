package com.example.starter_project_2025.system.project.board;

import com.example.starter_project_2025.system.project.sprint.SprintStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

public record TeamSprintCreateRequest(
        @NotBlank String name,
        String sprintGoal,
        LocalDateTime startDate,
        LocalDateTime endDate,
        @NotNull SprintStatus status
) {}
