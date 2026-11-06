package com.example.starter_project_2025.system.project.rubric.domain;

import java.math.BigDecimal;

public enum RubricRatingLevel {
    EXCELLENT(new BigDecimal("100.00")),
    GOOD(new BigDecimal("75.00")),
    FAIR(new BigDecimal("50.00")),
    NOT_MET(new BigDecimal("0.00"));

    private final BigDecimal percentage;

    RubricRatingLevel(BigDecimal percentage) {
        this.percentage = percentage;
    }

    public BigDecimal percentage() {
        return percentage;
    }
}
