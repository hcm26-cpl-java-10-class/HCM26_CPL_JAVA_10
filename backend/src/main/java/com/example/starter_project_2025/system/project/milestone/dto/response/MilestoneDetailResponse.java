package com.example.starter_project_2025.system.project.milestone.dto.response;

import com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record MilestoneDetailResponse(
        UUID id,
        MilestoneDetailProjectResponse project,
        String title,
        String description,
        Instant deadline,
        String tenantTimeZone,
        boolean mandatory,
        MilestoneStatus status,
        List<ChecklistItemResponse> checklist,
        MilestoneRubricDetailResponse rubric,
        MilestoneReviewerResponse reviewer,
        MilestoneLatePolicyResponse latePolicy,
        MilestoneResubmissionPolicyResponse resubmissionPolicy,
        long version,
        Instant createdAt,
        UUID createdBy
) {
}
