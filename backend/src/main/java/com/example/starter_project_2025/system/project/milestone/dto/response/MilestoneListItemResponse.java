package com.example.starter_project_2025.system.project.milestone.dto.response;

import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.domain.LatePenaltyBasis;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record MilestoneListItemResponse(
        UUID id,
        Long projectId,
        Long teamId,
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
        Instant createdAt,
        BigDecimal weight,
        LatePenaltyBasis latePenaltyBasis,
        String projectName,
        com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus executionStatus,
        @com.fasterxml.jackson.annotation.JsonIgnore com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus canonicalStatus,
        LocalDate startDate,
        Instant scheduledStartAt
) {
    @com.fasterxml.jackson.annotation.JsonProperty("lifecycleStatus")
    public String lifecycleStatus() {
        return canonicalStatus.name();
    }
}
