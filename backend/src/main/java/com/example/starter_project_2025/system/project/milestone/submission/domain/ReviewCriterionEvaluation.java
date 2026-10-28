package com.example.starter_project_2025.system.project.milestone.submission.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "milestone_review_criteria", uniqueConstraints = {
        @UniqueConstraint(name = "uk_review_criterion", columnNames = {"review_id", "criterion_id"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ReviewCriterionEvaluation {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "evaluation_id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "review_id", nullable = false, updatable = false)
    private MilestoneReview review;

    @Column(name = "criterion_id", nullable = false, updatable = false)
    private UUID criterionId;

    @Column(name = "criterion_code", nullable = false, length = 30)
    private String criterionCode;

    @Column(name = "criterion_name", nullable = false, length = 100)
    private String criterionName;

    @Column(name = "rating_id", nullable = false, updatable = false)
    private UUID ratingId;

    @Column(name = "rating_level", nullable = false, length = 20)
    private String ratingLevel;

    @Column(name = "rating_percentage", nullable = false, precision = 5, scale = 2)
    private BigDecimal ratingPercentage;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal score;

    @Column(length = 500)
    private String feedback;

    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    static ReviewCriterionEvaluation create(MilestoneReview review, UUID criterionId, String code,
                                            String name, UUID ratingId, String level,
                                            BigDecimal percentage, BigDecimal score,
                                            String feedback, int orderIndex) {
        ReviewCriterionEvaluation value = new ReviewCriterionEvaluation();
        value.review = review;
        value.criterionId = criterionId;
        value.criterionCode = code;
        value.criterionName = name;
        value.ratingId = ratingId;
        value.ratingLevel = level;
        value.ratingPercentage = percentage.setScale(2);
        value.score = score.setScale(2);
        value.feedback = feedback == null || feedback.isBlank() ? null : feedback.trim();
        value.orderIndex = orderIndex;
        return value;
    }
}
