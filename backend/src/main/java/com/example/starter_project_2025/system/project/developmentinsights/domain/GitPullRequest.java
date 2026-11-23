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

/** A GitHub Pull Request snapshot. Dev A owns ingestion; Dev B reads and reports it. */
@Entity
@Table(name = "pull_request", indexes = {
        @Index(name = "idx_pull_request_created", columnList = "gh_created_at"),
        @Index(name = "idx_pull_request_author", columnList = "author_contributor_id")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_pull_request_repository_number", columnNames = {"repository_id", "number"}),
        @UniqueConstraint(name = "uk_pull_request_repository_external", columnNames = {"repository_id", "external_id"})
})
@Getter
@Setter
@NoArgsConstructor
public class GitPullRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "repository_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_pull_request_repository"))
    @OnDelete(action = OnDeleteAction.CASCADE)
    private GitRepository repository;

    @Column(nullable = false)
    private Integer number;

    @Column(name = "external_id", nullable = false)
    private Long externalId;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String body;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_contributor_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_pull_request_author"))
    private GitContributor authorContributor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private GitPullRequestState state = GitPullRequestState.OPEN;

    @Column(name = "is_draft", nullable = false)
    private boolean draft;

    @Column(name = "source_branch", nullable = false, length = 200)
    private String sourceBranch;

    @Column(name = "target_branch", nullable = false, length = 200)
    private String targetBranch;

    @Column(name = "html_url", length = 2048)
    private String htmlUrl;

    @Column(name = "gh_created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "gh_updated_at", nullable = false)
    private Instant sourceUpdatedAt;

    @Column(name = "merged_at")
    private Instant mergedAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "first_review_at")
    private Instant firstReviewAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant recordedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /** Applies a source status only when it is newer than the stored GitHub snapshot. */
    public boolean applySourceStatus(GitPullRequestState nextState, Instant updatedAt,
                                     Instant nextMergedAt, Instant nextClosedAt) {
        if (updatedAt == null || (sourceUpdatedAt != null && !updatedAt.isAfter(sourceUpdatedAt))) return false;
        this.state = nextState;
        this.sourceUpdatedAt = updatedAt;
        this.mergedAt = nextMergedAt;
        this.closedAt = nextClosedAt;
        return true;
    }
}
