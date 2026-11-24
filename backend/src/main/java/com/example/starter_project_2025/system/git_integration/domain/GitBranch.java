package com.example.starter_project_2025.system.git_integration.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import jakarta.persistence.Column;
import jakarta.persistence.ConstraintMode;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

/**
 * SY-07: a branch of a linked repository, as last seen by a synchronization (branch listing) or a
 * push webhook. {@code head_oid} is the branch head on GitHub; {@code synced_head_oid} the head whose
 * commits were imported to the end: a sync reads a branch again only when the two differ.
 * A branch gone from GitHub keeps its row ({@code deleted_at}) and its commits.
 * <p>
 * Branch names are case-sensitive in Git while MySQL compares text case-insensitively, so the
 * row is unique by {@code name_key} (SHA-256 of the exact name), not by {@code name}.
 */
@Entity
@Table(
        name = "git_branches",
        uniqueConstraints = @UniqueConstraint(name = "uk_git_branch_repo_name", columnNames = {"repository_id", "name_key"}),
        indexes = @Index(name = "idx_git_branch_repo_live", columnList = "repository_id, deleted_at, head_committed_at"))
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GitBranch extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_gitbranch_tenant_id"))
    Tenant tenant;

    /**
     * {@code git_repositories.id}: the repository connection. No database FK: a connection row is
     * never deleted (it becomes INACTIVE), and the branch rows are a cache rebuilt by the next sync.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "repository_id", nullable = false,
            foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    GitRepository repository;

    /** Branch name without {@code refs/heads/}. */
    @Column(name = "name", nullable = false, length = 255)
    String name;

    /** {@link #keyOf(String)} of {@link #name}. */
    @Column(name = "name_key", nullable = false, length = 64)
    String nameKey;

    /** Head commit on GitHub at the last listing or push. */
    @Column(name = "head_oid", length = 64)
    String headOid;

    @Column(name = "head_committed_at")
    LocalDateTime headCommittedAt;

    /** Head whose commits were imported to the end; equal to {@link #headOid} = nothing to read. */
    @Column(name = "synced_head_oid", length = 64)
    String syncedHeadOid;

    @Column(name = "synced_at")
    LocalDateTime syncedAt;

    /** Commits of the branch that are not on the default branch, and the reverse (last compare). */
    @Column(name = "ahead_by")
    Integer aheadBy;

    @Column(name = "behind_by")
    Integer behindBy;

    /** The last read stopped at {@code sync-branch-max-pages}: older commits of the branch were not imported. */
    @Column(name = "truncated")
    Boolean truncated;

    /** The repository's default branch at the last listing (its history is imported by the commit step). */
    @Column(name = "default_branch")
    Boolean defaultBranch;

    /** Gone from GitHub (deleted branch); NULL while it exists. */
    @Column(name = "deleted_at")
    LocalDateTime deletedAt;

    /** {@code git_sync_jobs.id} of the last listing that saw the branch. */
    @Column(name = "last_seen_job_id")
    Long lastSeenJobId;

    @Version
    @Column(name = "version")
    Long version;

    public boolean isDefault() {
        return Boolean.TRUE.equals(defaultBranch);
    }

    public boolean isTruncated() {
        return Boolean.TRUE.equals(truncated);
    }

    /** True when the head changed since the last complete import (or the branch was never imported). */
    public boolean needsSync() {
        return headOid != null && !headOid.equals(syncedHeadOid);
    }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getTenantId() { return tenant == null ? null : tenant.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getRepositoryId() { return repository == null ? null : repository.getId(); }

    /** SHA-256 (hex) of the exact branch name: a case-sensitive key on every database. */
    public static String keyOf(String name) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(name.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}
