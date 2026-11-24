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
 * SY-04: a commit of a linked repository, ingested from a push webhook or (SY-01) the
 * synchronization of the default branch. One row per (repository connection, SHA): stored
 * values are never overwritten; a sync only fills columns still NULL (data a push payload
 * lacks). {@code first_seen_ref} keeps the branch the commit was first seen on.
 * Read by Analytics after {@code CommitIngestedEvent}.
 */
@Entity
@Table(
        name = "git_commits",
        uniqueConstraints = @UniqueConstraint(name = "uk_git_commit_repo_sha", columnNames = {"repository_id", "sha"}),
        indexes = {
                @Index(name = "idx_git_commit_project_time", columnList = "project_id, committed_at"),
                @Index(name = "idx_git_commit_repo_time", columnList = "repository_id, committed_at"),
                @Index(name = "idx_git_commit_repo_author", columnList = "repository_id, author_login, committed_at"),
                // WS-GH-02: branches of a repository (group by first_seen_ref, latest commit).
                @Index(name = "idx_git_commit_repo_ref", columnList = "repository_id, first_seen_ref, committed_at")
        })
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GitCommit extends BaseEntity implements GitArtifact {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_gitcommit_tenant_id"))
    Tenant tenant;

    /** {@code git_repositories.project_id} (master project) when the commit was ingested. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_gitcommit_project_id"))
    Project project;

    /** {@code git_repositories.id}: the repository connection. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "repository_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_gitcommit_repository_id"))
    GitRepository repository;

    @Column(name = "repo_external_id", nullable = false)
    Long repoExternalId;

    @Column(name = "sha", nullable = false, length = 64)
    String sha;

    /** Full message, truncated to the column size. */
    @Column(name = "message", length = 4000)
    String message;

    @Column(name = "author_name")
    String authorName;

    @Column(name = "author_email")
    String authorEmail;

    /** GitHub login; NULL when the author e-mail is not linked to a GitHub account. */
    @Column(name = "author_login", length = 100)
    String authorLogin;

    /** GitHub user id; only known when the commit was read from the API. */
    @Column(name = "author_github_id")
    Long authorGithubId;

    @Column(name = "committer_name")
    String committerName;

    @Column(name = "committer_email")
    String committerEmail;

    @Column(name = "committer_login", length = 100)
    String committerLogin;

    @Column(name = "authored_at")
    LocalDateTime authoredAt;

    @Column(name = "committed_at", nullable = false)
    LocalDateTime committedAt;

    @Column(name = "html_url", length = 500)
    String htmlUrl;

    /** {@code ref} of the push that first brought this commit, e.g. {@code refs/heads/main}. Never updated. */
    @Column(name = "first_seen_ref", nullable = false)
    String firstSeenRef;

    /** added + removed + modified files listed in the push payload; NULL when read from the API. */
    @Column(name = "files_changed")
    Integer filesChanged;

    /** Number of parents (more than 1 = merge commit); only known when read from the API. */
    @Column(name = "parent_count")
    Integer parentCount;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "source", nullable = false, length = 20)
    GitCommitSource source;

    /** {@code git_webhook_events.id} that brought the commit; NULL when a sync job did (SY-01). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ingested_event_id",
            foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    GitWebhookEvent ingestedEvent;

    /** SY-01: {@code git_sync_jobs.id} that brought the commit; NULL when a webhook did. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ingested_sync_job_id",
            foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    GitSyncJob ingestedSyncJob;

    /** SY-01: two parents or more; NULL while unknown (a push payload has no parents). */
    @Column(name = "is_merge")
    Boolean mergeCommit;

    /** SY-01: the GitHub author (else committer) login ends with {@code [bot]}; NULL = false. */
    @Column(name = "is_bot")
    Boolean bot;

    @Column(name = "ingested_at", nullable = false)
    LocalDateTime ingestedAt;

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getTenantId() { return tenant == null ? null : tenant.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getProjectId() { return project == null ? null : project.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getRepositoryId() { return repository == null ? null : repository.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getIngestedEventId() { return ingestedEvent == null ? null : ingestedEvent.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getIngestedSyncJobId() { return ingestedSyncJob == null ? null : ingestedSyncJob.getId(); }
}
