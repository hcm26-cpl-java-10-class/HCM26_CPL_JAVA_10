package com.example.starter_project_2025.system.project.milestone.dto.response;

import java.util.List;
import java.util.UUID;

public record MilestoneRubricDetailResponse(
        UUID snapshotId,
        String name,
        String version,
        List<MilestoneRubricCriterionResponse> criteria
) {
}

