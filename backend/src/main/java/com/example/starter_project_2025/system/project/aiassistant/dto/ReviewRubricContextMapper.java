package com.example.starter_project_2025.system.project.aiassistant.dto;

import com.example.starter_project_2025.system.project.rubric.domain.RubricVersion;
import org.springframework.stereotype.Component;

@Component
public class ReviewRubricContextMapper {

    public ReviewRubricContext toContext(RubricVersion version) {
        return new ReviewRubricContext(
                version.getId(),
                version.getNameSnapshot(),
                version.getDescriptionSnapshot(),
                "v" + version.getVersionNumber(),
                version.getStatus().name(),
                version.getTotalMaxScore(),
                version.getCriteria().stream()
                        .map(criterion -> new ReviewRubricCriterionContext(
                                criterion.getCode(),
                                criterion.getName(),
                                criterion.getWeight(),
                                criterion.getMaxScore(),
                                criterion.getRatings().stream()
                                        .map(rating -> new ReviewRubricRatingContext(
                                                rating.getLevel().name(),
                                                rating.getPercentage(),
                                                rating.getDescription(),
                                                rating.getOrderIndex()
                                        ))
                                        .toList()
                        ))
                        .toList()
        );
    }
}