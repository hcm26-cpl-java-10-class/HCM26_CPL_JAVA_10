package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.exam.domain.ScoreAdjustmentAction;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ScoreAppealAdjustmentDTO(
        Long id,
        Long appealId,
        Long attemptId,
        BigDecimal oldScore,
        BigDecimal newScore,
        String reason,
        Long actorId,
        String actorName,
        ScoreAdjustmentAction action,
        LocalDateTime createdAt
) {
}
