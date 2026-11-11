package com.example.starter_project_2025.system.exam.dto;

import java.math.BigDecimal;

public record GradeScaleDTO(
        Long id,
        String scaleType, // "GRADE" hoặc "PERCENTAGE"
        String gradeLetter,
        BigDecimal minScore,
        BigDecimal maxScore,
        String label,
        String color,
        Integer displayOrder
) {
}
