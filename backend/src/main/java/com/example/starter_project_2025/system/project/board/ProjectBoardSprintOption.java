package com.example.starter_project_2025.system.project.board;

import com.example.starter_project_2025.system.project.sprint.SprintStatus;

import java.time.LocalDateTime;

public record ProjectBoardSprintOption(
        Long id,
        String name,
        SprintStatus status,
        LocalDateTime startDate,
        LocalDateTime endDate
) {
}
