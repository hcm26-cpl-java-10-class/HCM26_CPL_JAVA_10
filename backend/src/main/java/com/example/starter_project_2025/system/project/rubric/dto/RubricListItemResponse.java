package com.example.starter_project_2025.system.project.rubric.dto;

import com.example.starter_project_2025.system.project.rubric.domain.RubricVersionStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record RubricListItemResponse(
        UUID id, UUID rowId, String name, String description, int versionCount, boolean hasDraft,
        UUID latestVersionId, int latestVersionNumber, RubricVersionStatus latestStatus,
        BigDecimal totalMaxScore, int criteriaCount, long milestoneUsageCount, Instant updatedAt
) {}
