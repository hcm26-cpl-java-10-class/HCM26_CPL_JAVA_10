package com.example.starter_project_2025.system.project.rubric.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Entity
@Table(name = "rubric_criterion_ratings", uniqueConstraints = {
        @UniqueConstraint(name = "uk_criterion_rating_level", columnNames = {"criterion_id", "level"}),
        @UniqueConstraint(name = "uk_criterion_rating_order", columnNames = {"criterion_id", "order_index"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RubricCriterionRating {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "rating_id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "criterion_id", nullable = false, updatable = false)
    private RubricCriterion criterion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RubricRatingLevel level;

    @Column(nullable = false, precision = 5, scale = 2)
    private java.math.BigDecimal percentage;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    static RubricCriterionRating create(RubricCriterion criterion, RubricRatingLevel level,
                                        String description, int orderIndex) {
        RubricCriterionRating rating = new RubricCriterionRating();
        rating.criterion = criterion;
        rating.level = level;
        rating.percentage = level.percentage();
        rating.description = description == null || description.isBlank() ? "" : description.trim();
        rating.orderIndex = orderIndex;
        return rating;
    }
}
