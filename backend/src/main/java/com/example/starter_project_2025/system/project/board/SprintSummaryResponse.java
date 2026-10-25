package com.example.starter_project_2025.system.project.board;

import java.time.LocalDateTime;

public record SprintSummaryResponse(
        Long id,
        String name,
        LocalDateTime startDate,
        LocalDateTime endDate,
        String sprintGoal
) {
}
