package com.example.starter_project_2025.system.exam.dto;

import java.math.BigDecimal;

public record AdjustScoreRequest(BigDecimal score, String reason) {
}
