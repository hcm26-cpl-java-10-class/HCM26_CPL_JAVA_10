package com.example.starter_project_2025.system.project.rubric.dto;

import com.example.starter_project_2025.system.project.rubric.domain.RubricVersionStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record RubricVersionResponse(
        UUID id, int versionNumber, String name, String description, RubricVersionStatus status,
        BigDecimal totalMaxScore, List<RubricCriterionResponse> criteria, long milestoneUsageCount,
        Instant publishedAt, Instant createdAt, Instant updatedAt, long lockVersion
) {}
