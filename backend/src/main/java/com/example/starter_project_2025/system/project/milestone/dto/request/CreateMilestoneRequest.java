package com.example.starter_project_2025.system.project.milestone.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CreateMilestoneRequest(
        @NotBlank(message = "Milestone title is required")
        @Size(max = 200, message = "Milestone title must not exceed 200 characters")
        String title,

        @Size(max = 2000, message = "Milestone description must not exceed 2000 characters")
        String description,

        @NotNull(message = "Deadline is required")
        Instant deadline,

        boolean mandatory,

        @NotEmpty(message = "At least one checklist item is required")
        @Size(max = 100, message = "Checklist must not contain more than 100 items")
        List<@Valid ChecklistItemRequest> checklist,

        @NotNull(message = "Rubric snapshot is required")
        UUID rubricSnapshotId,

        @NotNull(message = "Reviewer is required")
        UUID reviewerId,

        @NotNull(message = "Late policy is required")
        @Valid LatePolicyRequest latePolicy
) {
}
