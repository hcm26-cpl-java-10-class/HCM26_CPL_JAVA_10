package com.example.starter_project_2025.system.git_integration.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
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

/**
 * Repository connection: a GitHub repository linked to a project, reached
 * through one of the tenant's installations. Keyed by GitHub's numeric
 * repository id ({@code external_id}), which survives renames and transfers.
 * <p>
 * GI-03 only reads this table (to mark repositories already linked); GI-04
 * writes it. Rows are never deleted: unlinking or losing access changes
 * {@code status} so history stays available.
 * <p>
 * GI-04 / GI-05: {@code active_project_id} mirrors {@code project_id} while the
 * row is the project's current repository (any status but INACTIVE), and
 * {@code active_external_id} mirrors {@code external_id} while GitHub still
 * sends its events (ACTIVE or ERROR); NULL otherwise. Their unique constraints
 * enforce, in the database and under concurrency, "at most one current
 * repository per master project" and "a repository is synchronized in at most
 * one project" (H2 and MySQL have no partial unique indexes; unique columns
 * accept many NULLs).
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

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_gitrepository_tenant_id"))
    Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_gitrepository_project_id"))
    Project project;

    /** {@code git_installations.id} the repository is accessed through. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "installation_ref", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_gitrepository_installation_ref"))
    GitInstallation installation;

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

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "linked_by_user_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_gitrepository_linked_by_user_id"))
    User linkedByUser;

    @Column(name = "linked_at", nullable = false)
    LocalDateTime linkedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unlinked_by_user_id",
            foreignKey = @ForeignKey(name = "fk_gi_gitrepository_unlinked_by_user_id"))
    User unlinkedByUser;

    @Column(name = "unlinked_at")
    LocalDateTime unlinkedAt;

    @Column(name = "last_synced_at")
    LocalDateTime lastSyncedAt;

    /** GI-05: why the connection is not ACTIVE (see {@code GitRepositoryReason}); NULL while ACTIVE. */
    @Column(name = "status_reason", length = 50)
    String statusReason;

    /** GI-05: when {@code status} last changed. */
    @Column(name = "status_changed_at")
    LocalDateTime statusChangedAt;

    /**
     * SY-01: creation time of the last sync job that imported the commit history to the end; later
     * syncs read from one day before it. NULL = the whole history was never imported (also every
     * repository linked before SY-01), so the next sync reads it all.
     */
    @Column(name = "commit_history_synced_at")
    LocalDateTime commitHistorySyncedAt;

    /**
     * SY-02: creation time of the last sync job that read the pull requests to the end; later syncs
     * stop at pull requests updated more than a day before it. NULL = never read them all.
     */
    @Column(name = "pull_requests_synced_at")
    LocalDateTime pullRequestsSyncedAt;

    /** = {@code project_id} unless INACTIVE, NULL otherwise. Maintained by {@link #syncActiveKeys()}. */
    @Column(name = "active_project_id")
    Long activeProjectId;

    /** = {@code external_id} while ACTIVE or ERROR, NULL otherwise. Maintained by {@link #syncActiveKeys()}. */
    @Column(name = "active_external_id")
    Long activeExternalId;

    @Version
    @Column(name = "version")
    Long version;

    @PrePersist
    @PreUpdate
    void syncActiveKeys() {
        activeProjectId = status != null && status.holdsProject() ? getProjectId() : null;
        activeExternalId = status != null && status.holdsProject() ? externalId : null;
    }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getTenantId() { return tenant == null ? null : tenant.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getProjectId() { return project == null ? null : project.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getInstallationRef() { return installation == null ? null : installation.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getLinkedByUserId() { return linkedByUser == null ? null : linkedByUser.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getUnlinkedByUserId() { return unlinkedByUser == null ? null : unlinkedByUser.getId(); }
}
