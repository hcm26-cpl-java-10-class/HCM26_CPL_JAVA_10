package com.example.starter_project_2025.system.exam.grading.dto;

import java.math.BigDecimal;

public record AdjustScoreRequest(BigDecimal score, String reason) {
}
