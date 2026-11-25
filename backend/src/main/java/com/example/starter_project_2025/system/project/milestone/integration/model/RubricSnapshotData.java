package com.example.starter_project_2025.system.project.milestone.integration.model;

import java.util.List;
import java.util.UUID;

public record RubricSnapshotData(
        UUID id,
        String name,
        String version,
        boolean active,
        List<RubricCriterionData> criteria
) {
}
