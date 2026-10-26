package com.example.starter_project_2025.system.project.milestone.dto.response;

import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;

import java.math.BigDecimal;
import java.time.Instant;

public record MilestoneLatePolicyResponse(
        LatePolicyType type,
        Instant lateUntil,
        BigDecimal penaltyPercent
) {
}

