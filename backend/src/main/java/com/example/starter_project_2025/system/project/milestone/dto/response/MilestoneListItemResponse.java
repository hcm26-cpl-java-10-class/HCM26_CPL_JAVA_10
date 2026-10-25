package com.example.starter_project_2025.system.project.milestone.dto.response;

import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record MilestoneListItemResponse(
        UUID id,
        String title,
        String description,
        Instant deadline,
        MilestoneStatus status,
        boolean mandatory,
        UUID rubricSnapshotId,
        UUID reviewerId,
        LatePolicyType latePolicyType,
        Instant lateUntil,
        BigDecimal latePenaltyPercent,
        long version,
        Instant createdAt
) {
}
