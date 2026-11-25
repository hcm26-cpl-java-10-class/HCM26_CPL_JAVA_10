package com.example.starter_project_2025.system.git_integration.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
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
 * GI-06: a GitHub account whose ownership a user proved. System wide: one GitHub account
 * belongs to one internal user (BR5) and a user has one GitHub account. The GitHub user id is
 * the identity (BR2); the login is only displayed and refreshed when seen again (AC08).
 * No access token is stored.
 */
@Entity
@Table(
        name = "user_git_identities",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_user_git_identity_external", columnNames = {"provider", "external_user_id"}),
                @UniqueConstraint(name = "uk_user_git_identity_user", columnNames = {"user_id", "provider"})
        })
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UserGitIdentity extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_usergitidentity_tenant_id"))
    Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_usergitidentity_user_id"))
    User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, length = 20)
    GitProvider provider;

    @Column(name = "external_user_id", nullable = false)
    Long externalUserId;

    @Column(name = "login", nullable = false, length = 100)
    String login;

    @Column(name = "avatar_url", length = 500)
    String avatarUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 20)
    GitIdentitySource source;

    @Column(name = "verified_at", nullable = false)
    LocalDateTime verifiedAt;

    @Version
    @Column(name = "version")
    Long version;

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getTenantId() { return tenant == null ? null : tenant.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getUserId() { return user == null ? null : user.getId(); }
}
