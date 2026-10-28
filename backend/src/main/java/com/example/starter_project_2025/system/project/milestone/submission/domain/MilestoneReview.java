package com.example.starter_project_2025.system.project.milestone.submission.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "milestone_submission_reviews", uniqueConstraints = {
        @UniqueConstraint(name = "uk_review_submission_version", columnNames = "submission_version_id")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MilestoneReview {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "review_id", nullable = false, updatable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submission_version_id", nullable = false, updatable = false)
    private SubmissionVersion submissionVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ReviewDecision decision;

    @Column(name = "reviewer_id", nullable = false, updatable = false)
    private UUID reviewerId;

    @Column(name = "reviewer_name", nullable = false, length = 120)
    private String reviewerName;

    @Column(name = "raw_score", nullable = false, precision = 10, scale = 2)
    private BigDecimal rawScore;

    @Column(name = "penalty_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal penaltyPercent;

    @Column(name = "final_score", nullable = false, precision = 10, scale = 2)
    private BigDecimal finalScore;

    @Column(name = "reviewed_at", nullable = false, updatable = false)
    private Instant reviewedAt;

    @Column(name = "overall_feedback", length = 1000)
    private String overallFeedback;

    @OneToMany(mappedBy = "review", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    private List<ReviewCriterionEvaluation> evaluations = new ArrayList<>();

    public static MilestoneReview create(SubmissionVersion version, ReviewDecision decision,
                                         UUID reviewerId, String reviewerName, BigDecimal rawScore,
                                         BigDecimal penaltyPercent, BigDecimal finalScore,
                                         String overallFeedback, Instant now) {
        MilestoneReview value = new MilestoneReview();
        value.submissionVersion = version;
        value.decision = decision;
        value.reviewerId = reviewerId;
        value.reviewerName = reviewerName;
        value.rawScore = rawScore.setScale(2);
        value.penaltyPercent = penaltyPercent.setScale(2);
        value.finalScore = finalScore.max(BigDecimal.ZERO).setScale(2);
        value.overallFeedback = overallFeedback == null || overallFeedback.isBlank()
                ? null : overallFeedback.trim();
        value.reviewedAt = now;
        return value;
    }

    public static MilestoneReview create(SubmissionVersion version, ReviewDecision decision,
                                         UUID reviewerId, String reviewerName, BigDecimal rawScore,
                                         BigDecimal penaltyPercent, BigDecimal finalScore, Instant now) {
        return create(version, decision, reviewerId, reviewerName, rawScore, penaltyPercent,
                finalScore, null, now);
    }

    public void addEvaluation(UUID criterionId, String code, String name, UUID ratingId,
                              String ratingLevel, BigDecimal ratingPercentage, BigDecimal score,
                              String feedback, int orderIndex) {
        evaluations.add(ReviewCriterionEvaluation.create(this, criterionId, code, name, ratingId,
                ratingLevel, ratingPercentage, score, feedback, orderIndex));
    }
}
