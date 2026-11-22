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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * GI-01: a GitHub App installation on a GitHub account or organization,
 * owned by one tenant of the platform. It is deliberately not tied to a
 * project: projects pick repositories from installations later (GI-02).
 * Holds only public metadata — no token, secret or key.
 */
@Entity
@Table(
        name = "git_installations",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_git_installation_provider_installation",
                columnNames = {"provider", "installation_id"}),
        indexes = @Index(
                name = "idx_git_installation_tenant",
                columnList = "tenant_id, provider, is_active"))
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GitInstallation extends BaseEntity {

    @Column(name = "tenant_id", nullable = false)
    Long tenantId;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, length = 20)
    GitProvider provider;

    @Column(name = "installation_id", nullable = false)
    Long installationId;

    @Column(name = "account_id", nullable = false)
    Long accountId;

    @Column(name = "account_login", nullable = false, length = 100)
    String accountLogin;

    @Column(name = "account_type", nullable = false, length = 20)
    String accountType;

    @Column(name = "repository_selection", length = 20)
    String repositorySelection;

    // GI-02: VARCHAR, not a native ENUM, so new statuses (ERROR) need no schema change.
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 20)
    GitInstallationStatus status;

    /** GI-02: why the status last changed, e.g. TOKEN_REJECTED, UNINSTALLED, RECHECK_OK; never sensitive data. */
    @Column(name = "status_reason", length = 50)
    String statusReason;

    /** GI-02: when the status last changed. */
    @Column(name = "status_changed_at")
    LocalDateTime statusChangedAt;

    /** GI-02: last "Check again" (verified or not), for its cooldown; {@code last_verified_at} is the last success. */
    @Column(name = "last_checked_at")
    LocalDateTime lastCheckedAt;

    @Column(name = "connected_by_user_id", nullable = false)
    Long connectedByUserId;

    /** GI-07: who disconnected it from the platform (NULL when removed on GitHub, or never disconnected). */
    @Column(name = "disconnected_by_user_id")
    Long disconnectedByUserId;

    @Column(name = "github_user_id")
    Long githubUserId;

    @Column(name = "github_user_login", length = 100)
    String githubUserLogin;

    @Column(name = "connected_at", nullable = false)
    LocalDateTime connectedAt;

    @Column(name = "last_verified_at", nullable = false)
    LocalDateTime lastVerifiedAt;

    @Version
    @Column(name = "version")
    Long version;
}
