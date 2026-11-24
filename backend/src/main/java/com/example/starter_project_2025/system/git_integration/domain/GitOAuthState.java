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
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

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

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_gitoauthstate_user_id"))
    User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_gitoauthstate_tenant_id"))
    Tenant tenant;

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
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id",
            foreignKey = @ForeignKey(name = "fk_gi_gitoauthstate_project_id"))
    Project project;

    public GitOAuthPurpose effectivePurpose() {
        return purpose == null ? GitOAuthPurpose.INSTALL : purpose;
    }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getTenantId() { return tenant == null ? null : tenant.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getProjectId() { return project == null ? null : project.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getUserId() { return user == null ? null : user.getId(); }
}
