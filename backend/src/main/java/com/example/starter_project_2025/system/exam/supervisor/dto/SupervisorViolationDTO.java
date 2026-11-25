package com.example.starter_project_2025.system.exam.supervisor.dto;

import java.time.Instant;

public record SupervisorViolationDTO(
        Long id,
        Long attemptId,
        String studentName,
        String examTitle,
        String type,
        Instant occurredAt,
        Integer durationSeconds,
        String detail
) {
}