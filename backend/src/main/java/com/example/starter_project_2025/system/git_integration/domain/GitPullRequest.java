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
 * SY-04: latest known state of a pull request of a linked repository. Webhook
 * events may arrive out of order, so a row is only overwritten by data whose
 * GitHub {@code updated_at} is not older than {@link #githubUpdatedAt} (AC05).
 */
@Entity
@Table(
        name = "git_pull_requests",
        uniqueConstraints = @UniqueConstraint(name = "uk_git_pr_repo_number", columnNames = {"repository_id", "number"}),
        indexes = {
                @Index(name = "idx_git_pr_project_state", columnList = "project_id, state, github_updated_at"),
                @Index(name = "idx_git_pr_repo_state", columnList = "repository_id, state, github_updated_at"),
                @Index(name = "idx_git_pr_repo_author", columnList = "repository_id, author_login"),
                // WS-GH-02: pull requests opened / merged in an insights period.
                @Index(name = "idx_git_pr_repo_created", columnList = "repository_id, github_created_at"),
                @Index(name = "idx_git_pr_repo_merged", columnList = "repository_id, merged_at")
        })
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GitPullRequest extends BaseEntity implements GitArtifact {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_gitpullrequest_tenant_id"))
    Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_gitpullrequest_project_id"))
    Project project;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "repository_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_gitpullrequest_repository_id"))
    GitRepository repository;

    @Column(name = "repo_external_id", nullable = false)
    Long repoExternalId;

    /** {@code pull_request.id}. */
    @Column(name = "external_id", nullable = false)
    Long externalId;

    @Column(name = "number", nullable = false)
    Integer number;

    @Column(name = "title", nullable = false, length = 500)
    String title;

    @Column(name = "body", length = 4000)
    String body;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "state", nullable = false, length = 20)
    GitPullRequestState state;

    @Column(name = "draft", nullable = false)
    Boolean draft;

    @Column(name = "author_login", length = 100)
    String authorLogin;

    @Column(name = "author_github_id")
    Long authorGithubId;

    @Column(name = "head_ref")
    String headRef;

    @Column(name = "head_sha", length = 64)
    String headSha;

    @Column(name = "base_ref")
    String baseRef;

    @Column(name = "merge_commit_sha", length = 64)
    String mergeCommitSha;

    @Column(name = "task_mapping_fingerprint", length = 64)
    String taskMappingFingerprint;

    @Column(name = "merged_by_login", length = 100)
    String mergedByLogin;

    @Column(name = "commits_count")
    Integer commitsCount;

    @Column(name = "additions")
    Integer additions;

    @Column(name = "deletions")
    Integer deletions;

    @Column(name = "changed_files")
    Integer changedFiles;

    @Column(name = "html_url", length = 500)
    String htmlUrl;

    @Column(name = "github_created_at", nullable = false)
    LocalDateTime githubCreatedAt;

    /** {@code pull_request.updated_at}: the out-of-order guard (AC05). */
    @Column(name = "github_updated_at", nullable = false)
    LocalDateTime githubUpdatedAt;

    @Column(name = "closed_at")
    LocalDateTime closedAt;

    @Column(name = "merged_at")
    LocalDateTime mergedAt;

    /** Action of the event that wrote the current data, e.g. {@code closed}, {@code review_submitted}. */
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
}
