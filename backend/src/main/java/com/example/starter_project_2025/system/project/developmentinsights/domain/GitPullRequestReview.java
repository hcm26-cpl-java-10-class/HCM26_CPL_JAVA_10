package com.example.starter_project_2025.system.project.developmentinsights.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.annotations.UpdateTimestamp;

/** One submitted GitHub review, identified within its Pull Request by source review ID. */
@Entity(name = "ActivityGitPullRequestReview")
@Table(name = "pull_request_review", indexes = {
        @Index(name = "idx_pull_request_review_submitted", columnList = "pull_request_id, submitted_at"),
        @Index(name = "idx_pull_request_review_reviewer", columnList = "reviewer_contributor_id, submitted_at")
}, uniqueConstraints = @UniqueConstraint(name = "uk_pull_request_review_source_id",
        columnNames = {"pull_request_id", "external_id"}))
@Getter
@Setter
@NoArgsConstructor
public class GitPullRequestReview {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pull_request_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_pull_request_review_pull_request"))
    @OnDelete(action = OnDeleteAction.CASCADE)
    private GitPullRequest pullRequest;

    @Column(name = "external_id", nullable = false)
    private Long externalId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reviewer_contributor_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_pull_request_review_reviewer"))
    private GitContributor reviewerContributor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private GitPullRequestReviewState state;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "source_updated_at")
    private Instant sourceUpdatedAt;

    @Column(name = "is_self_review", nullable = false)
    private boolean selfReview;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant recordedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /** Applies a replayed source state only when its source update is newer. */
    public boolean applySourceState(GitPullRequestReviewState nextState, Instant nextSubmittedAt,
                                    Instant updatedAt) {
        if (updatedAt == null || (sourceUpdatedAt != null && !updatedAt.isAfter(sourceUpdatedAt))) return false;
        this.state = nextState;
        this.submittedAt = nextSubmittedAt;
        this.sourceUpdatedAt = updatedAt;
        return true;
    }
}
