package com.example.starter_project_2025.system.project.milestone.dto.response;

import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.domain.LatePenaltyBasis;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record MilestoneResponse(
        UUID id,
        Long projectId,
        Long teamId,
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
        List<ChecklistItemResponse> checklist,
        BigDecimal weight,
        LatePenaltyBasis latePenaltyBasis,
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
