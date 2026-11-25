package com.example.starter_project_2025.system.git_integration.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import jakarta.persistence.Column;
import jakarta.persistence.ConstraintMode;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * SY-04: latest known state of a pull request review. A review payload has no
 * {@code updated_at}, so the out-of-order guard is the pair
 * ({@link #sourceUpdatedAt}, {@link #sourceActionRank}): the pull request's
 * {@code updated_at} carried by the same event, then submitted (1) &lt; edited (2)
 * &lt; dismissed (3). Only a strictly greater pair overwrites the row (AC05).
 */
@Entity
@Table(
        name = "git_pull_request_reviews",
        uniqueConstraints = @UniqueConstraint(name = "uk_git_review_pr_external", columnNames = {"pull_request_id", "external_id"}),
        indexes = {
                @Index(name = "idx_git_review_pr", columnList = "pull_request_id, submitted_at"),
                @Index(name = "idx_git_review_project_reviewer", columnList = "project_id, reviewer_login, submitted_at"),
                // WS-GH-02: reviews submitted in an insights period.
                @Index(name = "idx_git_review_repo_time", columnList = "repository_id, submitted_at")
        })
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GitPullRequestReview extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_gitpullrequestreview_tenant_id"))
    Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_gitpullrequestreview_project_id"))
    Project project;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "repository_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_gitpullrequestreview_repository_id"))
    GitRepository repository;

    /** Read-only association, only for the foreign key to {@code git_pull_requests}. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pull_request_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_git_review_pull_request"))
    GitPullRequest pullRequest;

    /** {@code review.id}. */
    @Column(name = "external_id", nullable = false)
    Long externalId;

    @Column(name = "reviewer_login", length = 100)
    String reviewerLogin;

    @Column(name = "reviewer_github_id")
    Long reviewerGithubId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "state", nullable = false, length = 20)
    GitReviewState state;

    @Column(name = "body", length = 4000)
    String body;

    /** {@code review.commit_id}: the commit the reviewer looked at. */
    @Column(name = "commit_sha", length = 64)
    String commitSha;

    @Column(name = "submitted_at")
    LocalDateTime submittedAt;

    /** When the dismissal was processed (GitHub sends no dedicated timestamp). */
    @Column(name = "dismissed_at")
    LocalDateTime dismissedAt;

    @Column(name = "html_url", length = 500)
    String htmlUrl;

    @Column(name = "source_updated_at", nullable = false)
    LocalDateTime sourceUpdatedAt;

    @Column(name = "source_action_rank", nullable = false)
    Integer sourceActionRank;

    @Column(name = "last_action", length = 50)
    String lastAction;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_event_id",
            foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    GitWebhookEvent lastEvent;

    /** SY-02: the sync job that wrote the current version; NULL when a webhook did ({@code last_event_id}). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_sync_job_id",
            foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    GitSyncJob lastSyncJob;

    @Version
    @Column(name = "version")
    Long version;

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getTenantId() { return tenant == null ? null : tenant.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getProjectId() { return project == null ? null : project.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getRepositoryId() { return repository == null ? null : repository.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getLastEventId() { return lastEvent == null ? null : lastEvent.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getLastSyncJobId() { return lastSyncJob == null ? null : lastSyncJob.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getPullRequestId() { return pullRequest == null ? null : pullRequest.getId(); }
}
