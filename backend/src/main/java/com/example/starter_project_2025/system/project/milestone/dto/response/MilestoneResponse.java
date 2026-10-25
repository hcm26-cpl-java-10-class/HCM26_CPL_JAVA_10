package com.example.starter_project_2025.system.project.milestone.dto.response;

import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record MilestoneResponse(
        UUID id,
        UUID projectId,
        String title,
        String description,
        Instant deadline,
        boolean mandatory,
        MilestoneStatus status,
        UUID rubricSnapshotId,
        UUID reviewerId,
        LatePolicyType latePolicyType,
        Instant lateUntil,
        BigDecimal latePenaltyPercent,
        long version,
        Instant createdAt,
        UUID createdBy,
        List<ChecklistItemResponse> checklist
) {
}
