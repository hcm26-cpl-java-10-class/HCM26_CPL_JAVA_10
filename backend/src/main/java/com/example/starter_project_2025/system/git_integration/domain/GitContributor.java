package com.example.starter_project_2025.system.git_integration.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
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
 * GI-06: a person who committed, opened a pull request or reviewed in a master project's
 * repository, identified by GitHub user id ({@code gh:123}) or, for commits whose e-mail is not
 * linked to GitHub, by that e-mail ({@code email:dev@x.com}). One row per identity and master
 * project, so a GitHub account maps to at most one member of the master and its modules (BR6).
 * {@code user_id} null means Unmapped Contributor. Statistics resolve Git rows through this
 * table when read, so mapping never rewrites Git data (AC09).
 */
@Entity
@Table(
        name = "git_contributors",
        uniqueConstraints = @UniqueConstraint(name = "uk_git_contributor_master_identity",
                columnNames = {"master_project_id", "identity_key"}),
        indexes = {
                @Index(name = "idx_git_contributor_master_user", columnList = "master_project_id, user_id"),
                @Index(name = "idx_git_contributor_master_external", columnList = "master_project_id, external_user_id")
        })
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GitContributor extends BaseEntity {

    @Column(name = "tenant_id", nullable = false)
    Long tenantId;

    @Column(name = "master_project_id", nullable = false)
    Long masterProjectId;

    @Column(name = "identity_key", nullable = false, length = 320)
    String identityKey;

    /** GitHub user id; null for an e-mail-only contributor. */
    @Column(name = "external_user_id")
    Long externalUserId;

    /** Normalized e-mail of an e-mail-only contributor. */
    @Column(name = "email")
    String email;

    @Column(name = "login", length = 100)
    String login;

    @Column(name = "display_name")
    String displayName;

    @Column(name = "user_id")
    Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "map_source", length = 20)
    GitContributorMapSource mapSource;

    @Column(name = "mapped_by_user_id")
    Long mappedByUserId;

    @Column(name = "mapped_at")
    LocalDateTime mappedAt;

    @Column(name = "first_seen_at")
    LocalDateTime firstSeenAt;

    @Column(name = "last_seen_at")
    LocalDateTime lastSeenAt;

    @Version
    @Column(name = "version")
    Long version;

    public boolean isGitHub() {
        return externalUserId != null;
    }

    public void map(Long memberId, GitContributorMapSource source, Long byUserId, LocalDateTime at) {
        this.userId = memberId;
        this.mapSource = source;
        this.mappedByUserId = byUserId;
        this.mappedAt = at;
    }

    public void unmap() {
        map(null, null, null, null);
    }
}
