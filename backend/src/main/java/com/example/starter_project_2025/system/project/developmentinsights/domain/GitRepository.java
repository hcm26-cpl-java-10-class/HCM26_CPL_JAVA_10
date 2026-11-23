package com.example.starter_project_2025.system.project.developmentinsights.domain;

import com.example.starter_project_2025.system.project.domain.Project;
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
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

/** Shared Git source contract. Dev A owns synchronization; Dev B reads this data. */
@Entity
@Table(name = "git_repository", indexes = {
        @Index(name = "idx_git_repository_root", columnList = "root_project_id")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_git_repository_root_external", columnNames = {"root_project_id", "external_id"}),
        @UniqueConstraint(name = "uk_git_repository_active_root", columnNames = "active_root_project_id"),
        @UniqueConstraint(name = "uk_git_repository_active_external", columnNames = "active_external_id")
})
@Getter
@Setter
@NoArgsConstructor
public class GitRepository {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "root_project_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_git_repository_root_project"))
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Project rootProject;

    @Column(name = "external_id", nullable = false)
    private Long externalId;

    @Column(nullable = false, length = 100)
    private String owner;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "full_name", nullable = false, length = 200)
    private String fullName;

    @Column(name = "html_url", length = 2048)
    private String htmlUrl;

    @Column(name = "default_branch", length = 255)
    private String defaultBranch;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private GitRepositoryStatus status = GitRepositoryStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(name = "sync_status", nullable = false, length = 24)
    private GitSyncStatus syncStatus = GitSyncStatus.NOT_SYNCED;

    @Column(name = "linked_at")
    private Instant linkedAt;

    @Column(name = "unlinked_at")
    private Instant unlinkedAt;

    @Column(name = "last_synced_at")
    private Instant lastSyncedAt;

    /** Marks development fixtures so the UI never presents them as GitHub data. */
    @Column(name = "mock_data", nullable = false)
    private boolean mockData;

    @Column(name = "active_root_project_id", insertable = false, updatable = false,
            columnDefinition = "BIGINT GENERATED ALWAYS AS (CASE WHEN status <> 'INACTIVE' THEN root_project_id ELSE NULL END)")
    private Long activeRootProjectId;

    @Column(name = "active_external_id", insertable = false, updatable = false,
            columnDefinition = "BIGINT GENERATED ALWAYS AS (CASE WHEN status <> 'INACTIVE' THEN external_id ELSE NULL END)")
    private Long activeExternalId;

    public void markInactive(Instant unlinkedAt) {
        this.status = GitRepositoryStatus.INACTIVE;
        this.unlinkedAt = unlinkedAt;
    }

    public void relink(Instant linkedAt, String defaultBranch) {
        this.status = GitRepositoryStatus.ACTIVE;
        this.syncStatus = GitSyncStatus.SYNCING;
        this.linkedAt = linkedAt;
        this.unlinkedAt = null;
        this.defaultBranch = defaultBranch;
    }
}
