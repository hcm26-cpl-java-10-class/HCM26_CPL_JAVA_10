package com.example.starter_project_2025.system.exam.grading.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record ScoreAdjustmentHistoryDTO(Long id, Long attemptId, Integer attemptNumber, String studentName,
                                        BigDecimal oldScore, BigDecimal newScore, String reason,
                                        Long adjustedById, String adjustedByName, Instant adjustedAt) {
}
