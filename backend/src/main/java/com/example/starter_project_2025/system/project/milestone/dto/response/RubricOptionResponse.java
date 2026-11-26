package com.example.starter_project_2025.system.project.milestone.dto.response;

import com.example.starter_project_2025.system.project.milestone.integration.model.RubricSnapshotData;
import java.util.List;
import java.util.UUID;

public record RubricOptionResponse(
        UUID id,
        String name,
        String version,
        List<RubricCriterionOptionResponse> criteria
) {
    public static RubricOptionResponse from(RubricSnapshotData rubric) {
        return new RubricOptionResponse(rubric.id(), rubric.name(), rubric.version(),
                rubric.criteria().stream().map(criterion -> new RubricCriterionOptionResponse(
                        criterion.code(), criterion.name(), criterion.weight(), criterion.maxScore(),
                        criterion.ratings().stream().map(rating -> new RubricRatingOptionResponse(
                                rating.level(), rating.percentage(), rating.description(), rating.orderIndex()))
                                .toList())).toList());
    }
}

