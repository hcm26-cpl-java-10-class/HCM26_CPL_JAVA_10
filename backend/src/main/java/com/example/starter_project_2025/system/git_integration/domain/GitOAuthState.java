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
 * Only the SHA-256 hash is stored. Lifecycle: ISSUED (consumed_at null, not
 * expired) → CONSUMED (consumed_at set, with outcome) or EXPIRED.
 */
@Entity
@Table(
        name = "git_oauth_states",
        indexes = @Index(name = "idx_git_oauth_state_expires", columnList = "expires_at"))
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GitOAuthState extends BaseEntity {

    @Column(name = "state_hash", nullable = false, unique = true, length = 64)
    String stateHash;

    @Column(name = "user_id", nullable = false)
    Long userId;

    @Column(name = "tenant_id", nullable = false)
    Long tenantId;

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

    /** GI-06: null on rows issued before the column existed, which were all {@link GitOAuthPurpose#INSTALL}. */
    @Enumerated(EnumType.STRING)
    @Column(name = "purpose", length = 20)
    GitOAuthPurpose purpose;

    /** GI-06: the master project an {@link GitOAuthPurpose#ACCOUNT_LINK} state maps the account into. */
    @Column(name = "project_id")
    Long projectId;

    public GitOAuthPurpose effectivePurpose() {
        return purpose == null ? GitOAuthPurpose.INSTALL : purpose;
    }
}
