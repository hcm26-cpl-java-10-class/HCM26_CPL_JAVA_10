package com.example.starter_project_2025.system.project.rubric.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "rubric_criteria", uniqueConstraints = {
        @UniqueConstraint(name = "uk_rubric_criterion_code", columnNames = {"rubric_version_id", "code"}),
        @UniqueConstraint(name = "uk_rubric_criterion_order", columnNames = {"rubric_version_id", "order_index"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RubricCriterion {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "criterion_id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "rubric_version_id", nullable = false, updatable = false)
    private RubricVersion version;

    @Column(nullable = false, length = 30)
    private String code;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal weight;

    @Column(name = "max_score", nullable = false, precision = 10, scale = 2)
    private BigDecimal maxScore;

    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    @OneToMany(mappedBy = "criterion", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    private List<RubricCriterionRating> ratings = new ArrayList<>();

    static RubricCriterion create(RubricVersion version, String code, String name, String description,
                                   BigDecimal weight, BigDecimal maxScore, int orderIndex,
                                   List<RubricVersion.RatingValue> ratingValues) {
        RubricCriterion criterion = new RubricCriterion();
        criterion.version = version;
        criterion.code = code.trim().toUpperCase();
        criterion.name = name.trim();
        criterion.description = description == null || description.isBlank() ? null : description.trim();
        criterion.weight = weight.setScale(2);
        criterion.maxScore = maxScore.setScale(2);
        criterion.orderIndex = orderIndex;
        List<RubricVersion.RatingValue> values = ratingValues == null ? List.of() : ratingValues;
        if (values.isEmpty()) {
            for (RubricRatingLevel level : RubricRatingLevel.values()) {
                criterion.ratings.add(RubricCriterionRating.create(criterion, level,
                        "Default guidance for " + level.name().toLowerCase().replace('_', ' '),
                        criterion.ratings.size()));
            }
        } else {
            for (RubricVersion.RatingValue value : values) {
                criterion.ratings.add(RubricCriterionRating.create(criterion, value.level(),
                        value.description(), criterion.ratings.size()));
            }
        }
        return criterion;
    }
}
