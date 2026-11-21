package com.example.starter_project_2025.system.git_integration.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

/**
 * Repository connection: a GitHub repository linked to a project, reached
 * through one of the tenant's installations. Keyed by GitHub's numeric
 * repository id ({@code external_id}), which survives renames and transfers.
 * <p>
 * GI-03 only reads this table (to mark repositories already linked); GI-04
 * writes it. Rows are never deleted: unlinking or losing access changes
 * {@code status} so history stays available.
 * <p>
 * GI-04: {@code active_project_id} / {@code active_external_id} mirror
 * {@code project_id} / {@code external_id} only while the row is ACTIVE and are
 * NULL otherwise. Their unique constraints enforce, in the database and under
 * concurrency, "at most one ACTIVE repository per master project" and "a
 * repository is ACTIVE in at most one project" (H2 and MySQL have no partial
 * unique indexes; unique columns accept many NULLs).
 */
@Entity
@Table(
        name = "git_repositories",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_git_repo_active_project", columnNames = "active_project_id"),
                @UniqueConstraint(name = "uk_git_repo_active_external", columnNames = {"provider", "active_external_id"})
        },
        indexes = {
                @Index(name = "idx_git_repo_provider_external_status", columnList = "provider, external_id, status"),
                @Index(name = "idx_git_repo_project", columnList = "project_id, status"),
                @Index(name = "idx_git_repo_installation", columnList = "installation_ref, status")
        })
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GitRepository extends BaseEntity {

    @Column(name = "tenant_id", nullable = false)
    Long tenantId;

    @Column(name = "project_id", nullable = false)
    Long projectId;

    /** {@code git_installations.id} the repository is accessed through. */
    @Column(name = "installation_ref", nullable = false)
    Long installationRef;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, length = 20)
    GitProvider provider;

    @Column(name = "external_id", nullable = false)
    Long externalId;

    @Column(name = "owner_login", nullable = false, length = 100)
    String ownerLogin;

    @Column(name = "name", nullable = false, length = 100)
    String name;

    @Column(name = "full_name", nullable = false, length = 200)
    String fullName;

    @Column(name = "html_url", nullable = false, length = 500)
    String htmlUrl;

    @Column(name = "visibility", nullable = false, length = 20)
    String visibility;

    @Column(name = "default_branch", length = 100)
    String defaultBranch;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    GitRepositoryStatus status;

    @Column(name = "linked_by_user_id", nullable = false)
    Long linkedByUserId;

    @Column(name = "linked_at", nullable = false)
    LocalDateTime linkedAt;

    @Column(name = "unlinked_by_user_id")
    Long unlinkedByUserId;

    @Column(name = "unlinked_at")
    LocalDateTime unlinkedAt;

    @Column(name = "last_synced_at")
    LocalDateTime lastSyncedAt;

    /**
     * SY-01: creation time of the last sync job that imported the commit history to the end; later
     * syncs read from one day before it. NULL = the whole history was never imported (also every
     * repository linked before SY-01), so the next sync reads it all.
     */
    @Column(name = "commit_history_synced_at")
    LocalDateTime commitHistorySyncedAt;

    /** = {@code project_id} while ACTIVE, NULL otherwise. Maintained by {@link #syncActiveKeys()}. */
    @Column(name = "active_project_id")
    Long activeProjectId;

    /** = {@code external_id} while ACTIVE, NULL otherwise. Maintained by {@link #syncActiveKeys()}. */
    @Column(name = "active_external_id")
    Long activeExternalId;

    @Version
    @Column(name = "version")
    Long version;

    @PrePersist
    @PreUpdate
    void syncActiveKeys() {
        boolean active = status == GitRepositoryStatus.ACTIVE;
        activeProjectId = active ? projectId : null;
        activeExternalId = active ? externalId : null;
    }
}
