package com.example.starter_project_2025.system.project.milestone.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Digits;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CreateMilestoneRequest(
        @NotNull(message = "Team is required")
        Long teamId,

        @NotBlank(message = "Milestone title is required")
        @Size(max = 120, message = "Milestone title must not exceed 120 characters")
        String title,

        @Size(max = 1000, message = "Milestone description must not exceed 1000 characters")
        String description,

        @NotNull(message = "Deadline is required")
        Instant deadline,

        boolean mandatory,

        @NotEmpty(message = "At least one checklist item is required")
        @Size(max = 100, message = "Checklist must not contain more than 100 items")
        List<@Valid ChecklistItemRequest> checklist,

        @NotNull(message = "Rubric snapshot is required")
        UUID rubricSnapshotId,

        /** Legacy field; new milestone forms leave reviewer assignment to submissions. */
        UUID reviewerId,

        @NotNull(message = "Late policy is required")
        @Valid LatePolicyRequest latePolicy,

        @Valid ResubmissionPolicyRequest resubmissionPolicy,

        @DecimalMin("0") @DecimalMax("100") @Digits(integer = 3, fraction = 2)
        BigDecimal weight,
        @jakarta.validation.constraints.Min(0) @jakarta.validation.constraints.Max(365)
        Integer deadlineOffsetDays
) {
    public CreateMilestoneRequest(Long teamId, String title, String description, Instant deadline,
            boolean mandatory, List<ChecklistItemRequest> checklist, UUID rubricSnapshotId,
            UUID reviewerId, LatePolicyRequest latePolicy, ResubmissionPolicyRequest resubmissionPolicy,
            BigDecimal weight) {
        this(teamId, title, description, deadline, mandatory, checklist, rubricSnapshotId,
                reviewerId, latePolicy, resubmissionPolicy, weight, null);
    }
    public CreateMilestoneRequest(Long teamId, String title, String description, Instant deadline,
                                  boolean mandatory, List<ChecklistItemRequest> checklist,
                                  UUID rubricSnapshotId, UUID reviewerId, LatePolicyRequest latePolicy,
                                  BigDecimal weight) {
        this(teamId, title, description, deadline, mandatory, checklist, rubricSnapshotId,
                reviewerId, latePolicy, null, weight);
    }

    public CreateMilestoneRequest(Long teamId, String title, String description, Instant deadline,
                                  boolean mandatory, List<ChecklistItemRequest> checklist,
                                  UUID rubricSnapshotId, UUID reviewerId, LatePolicyRequest latePolicy,
                                  ResubmissionPolicyRequest resubmissionPolicy) {
        this(teamId, title, description, deadline, mandatory, checklist, rubricSnapshotId,
                reviewerId, latePolicy, resubmissionPolicy, null);
    }

    public CreateMilestoneRequest(Long teamId, String title, String description, Instant deadline,
                                  boolean mandatory, List<ChecklistItemRequest> checklist,
                                  UUID rubricSnapshotId, UUID reviewerId, LatePolicyRequest latePolicy) {
        this(teamId, title, description, deadline, mandatory, checklist, rubricSnapshotId,
                reviewerId, latePolicy, null, null);
    }

    public CreateMilestoneRequest(String title, String description, Instant deadline, boolean mandatory,
                                  List<ChecklistItemRequest> checklist, UUID rubricSnapshotId,
                                  UUID reviewerId, LatePolicyRequest latePolicy) {
        this(null, title, description, deadline, mandatory, checklist, rubricSnapshotId, reviewerId,
                latePolicy, null, null);
    }
}
