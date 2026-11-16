package com.example.starter_project_2025.system.git_integration.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

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

    @Column(name = "tenant_id", nullable = false)
    Long tenantId;

    /** {@code git_repositories.id}. */
    @Column(name = "repository_id", nullable = false)
    Long repositoryId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    GitSyncJobType type;

    @Enumerated(EnumType.STRING)
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

    @Column(name = "requested_by_user_id")
    Long requestedByUserId;

    @Column(name = "started_at")
    LocalDateTime startedAt;

    @Column(name = "finished_at")
    LocalDateTime finishedAt;

    @Column(name = "error_code", length = 50)
    String errorCode;

    /** Sanitized; never contains tokens, headers or raw GitHub responses. */
    @Column(name = "error_message", length = 500)
    String errorMessage;

    /** Statistics collected by the sync steps, e.g. {@code {"branches":3}}. */
    @Lob
    @Column(name = "stats_json")
    String statsJson;

    @Version
    @Column(name = "version")
    Long version;
}
