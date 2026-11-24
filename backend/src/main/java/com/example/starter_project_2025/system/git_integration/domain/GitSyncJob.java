package com.example.starter_project_2025.system.git_integration.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.ConstraintMode;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * GI-04: one synchronization of a repository connection with GitHub. The table
 * is both the work queue (PENDING rows are picked up by the dispatcher/poller)
 * and the history shown to users (status, attempts, error, statistics).
 */
@Entity
@Table(
        name = "git_sync_jobs",
        uniqueConstraints = @UniqueConstraint(name = "uk_git_sync_dedupe", columnNames = "dedupe_key"),
        indexes = {
                @Index(name = "idx_git_sync_due", columnList = "status, next_run_at"),
                @Index(name = "idx_git_sync_repository", columnList = "repository_id, id")
        })
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GitSyncJob extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_gitsyncjob_tenant_id"))
    Tenant tenant;

    /** {@code git_repositories.id}. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "repository_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_gitsyncjob_repository_id"))
    GitRepository repository;

    // VARCHAR, not a native ENUM: new values (SY-01 PARTIAL) must not need a schema change.
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "type", nullable = false, length = 20)
    GitSyncJobType type;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 20)
    GitSyncJobStatus status;

    /** {@code INITIAL:{repositoryId}} so a connection gets exactly one initial sync; NULL for other types. */
    @Column(name = "dedupe_key", length = 100)
    String dedupeKey;

    @Builder.Default
    @Column(name = "attempt_count", nullable = false)
    Integer attemptCount = 0;

    @Column(name = "max_attempts", nullable = false)
    Integer maxAttempts;

    @Column(name = "next_run_at", nullable = false)
    LocalDateTime nextRunAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by_user_id",
            foreignKey = @ForeignKey(name = "fk_gi_gitsyncjob_requested_by_user_id"))
    User requestedByUser;

    @Column(name = "started_at")
    LocalDateTime startedAt;

    @Column(name = "last_claimed_at")
    LocalDateTime lastClaimedAt;

    @Column(name = "claim_token", length = 36)
    String claimToken;

    @Column(name = "finished_at")
    LocalDateTime finishedAt;

    /** A new claim invalidates every previous worker, including retries that reuse an attempt count. */
    public void startAttempt(LocalDateTime at) {
        status = GitSyncJobStatus.RUNNING;
        attemptCount = attemptCount == null ? 1 : attemptCount + 1;
        if (startedAt == null) startedAt = at;
        lastClaimedAt = at;
        claimToken = java.util.UUID.randomUUID().toString();
        finishedAt = null;
    }

    public boolean claimedBy(String token) {
        return claimToken != null && claimToken.equals(token);
    }

    @Column(name = "error_code", length = 50)
    String errorCode;

    /** Sanitized; never contains tokens, headers or raw GitHub responses. */
    @Column(name = "error_message", length = 500)
    String errorMessage;

    /** Statistics collected by the sync steps, e.g. {@code {"branches":3}}. */
    @Lob
    @Column(name = "stats_json")
    String statsJson;

    /** SY-01: step reached; NULL = {@link GitSyncPhase#METADATA} (jobs created before SY-01). */
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "phase", length = 30)
    GitSyncPhase phase;

    /** SY-01: GraphQL {@code endCursor} of the last commit page stored; NULL before the first page. */
    @Column(name = "commit_cursor", length = 255)
    String commitCursor;

    /** SY-01: {@code since} of the commit history, fixed when the commit phase starts (NULL = whole history). */
    @Column(name = "commit_since")
    LocalDateTime commitSince;

    /** SY-01: default branch read when the commit phase started; stored as {@code refs/heads/{branch}}. */
    @Column(name = "commit_branch", length = 255)
    String commitBranch;

    /** SY-01: head of the default branch when the commit phase started (the cursor follows that history). */
    @Column(name = "commit_head_oid", length = 64)
    String commitHeadOid;

    /** SY-01: commit pages stored by this job; NULL = 0. */
    @Column(name = "pages_done")
    Integer pagesDone;

    /** SY-02: GraphQL {@code endCursor} of the last pull request page stored; NULL before the first page. */
    @Column(name = "pr_cursor", length = 255)
    String prCursor;

    /** SY-02: pull requests updated before this are not read again (NULL = all), fixed when the step starts. */
    @Column(name = "pr_since")
    LocalDateTime prSince;

    /** SY-02: pull request pages stored by this job; NULL = 0. */
    @Column(name = "pr_pages_done")
    Integer prPagesDone;

    /** SY-06: the stopped job this one continues (resume) or runs again (failed initial import). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resumed_from_job_id",
            foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    GitSyncJob resumedFromJob;

    @Version
    @Column(name = "version")
    Long version;

    public GitSyncPhase effectivePhase() {
        return phase == null ? GitSyncPhase.METADATA : phase;
    }

    public int pages() {
        return pagesDone == null ? 0 : pagesDone;
    }

    public int prPages() {
        return prPagesDone == null ? 0 : prPagesDone;
    }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getTenantId() { return tenant == null ? null : tenant.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getRepositoryId() { return repository == null ? null : repository.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getRequestedByUserId() { return requestedByUser == null ? null : requestedByUser.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getResumedFromJobId() { return resumedFromJob == null ? null : resumedFromJob.getId(); }
}
