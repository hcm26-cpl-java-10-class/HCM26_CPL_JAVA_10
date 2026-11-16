package com.example.starter_project_2025.system.git_integration.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

/**
 * One-time anti-CSRF state issued when a user starts "Connect GitHub".
 * Only the SHA-256 hash of the state is stored; the raw value lives in the
 * user's browser for at most {@code app.github.state-ttl-seconds}.
 */
@Entity
@Table(
        name = "git_integration_oauth_states",
        indexes = @Index(name = "idx_git_oauth_state_expires", columnList = "expires_at"))
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GitIntegrationOAuthState extends BaseEntity {

    @Column(name = "state_hash", nullable = false, unique = true, length = 64)
    String stateHash;

    @Column(name = "user_id", nullable = false)
    Long userId;

    @Column(name = "project_id", nullable = false)
    Long projectId;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, length = 20)
    GitProvider provider;

    @Column(name = "expires_at", nullable = false)
    LocalDateTime expiresAt;

    @Column(name = "consumed_at")
    LocalDateTime consumedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "outcome", length = 30)
    GitOAuthOutcome outcome;
}
