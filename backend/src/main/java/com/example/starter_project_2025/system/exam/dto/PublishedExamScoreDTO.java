package com.example.starter_project_2025.system.exam.dto;

import java.time.Instant;

public record PublishedExamScoreDTO(
        Long examId,
        String examTitle,
        int attemptNumber,
        Integer objectiveScore,
        Integer finalScore,
        Integer totalPoints,
        Instant submittedAt
) {
}
