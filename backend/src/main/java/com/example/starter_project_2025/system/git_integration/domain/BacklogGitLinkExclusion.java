package com.example.starter_project_2025.system.git_integration.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
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
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.Any;
import org.hibernate.annotations.AnyDiscriminatorValue;
import org.hibernate.annotations.AnyKeyJavaClass;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * TM-03: a task ↔ pull request pair a user unlinked. While the row exists, automatic
 * mapping does not link the pair again even though the pull request still names the
 * Task ID (its reference becomes {@link BacklogReferenceStatus#EXCLUDED}). Linking the
 * pair manually removes the row.
 */
@Entity
@Table(
        name = "backlog_git_link_exclusion",
        uniqueConstraints = @UniqueConstraint(name = "uk_backlog_git_link_excl",
                columnNames = {"backlog_item_id", "artifact_type", "artifact_id"}),
        indexes = @Index(name = "idx_backlog_git_link_excl_artifact", columnList = "artifact_type, artifact_id"))
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BacklogGitLinkExclusion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_backloggitlinkexclusion_tenant_id"))
    Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "backlog_item_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_backloggitlinkexclusion_backlog_item_id"))
    SprintBacklog backlogItem;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "artifact_type", nullable = false, length = 20, insertable = false, updatable = false)
    GitArtifactType artifactType;

    @Any(fetch = FetchType.LAZY)
    @AnyKeyJavaClass(Long.class)
    @AnyDiscriminatorValue(discriminator = "COMMIT", entity = GitCommit.class)
    @AnyDiscriminatorValue(discriminator = "PULL_REQUEST", entity = GitPullRequest.class)
    @Column(name = "artifact_type", nullable = false, length = 20)
    @JoinColumn(name = "artifact_id", nullable = false)
    GitArtifact artifact;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "excluded_by_user_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_backloggitlinkexclusion_excluded_by_user_id"))
    User excludedByUser;

    @Column(name = "excluded_at", nullable = false)
    LocalDateTime excludedAt;

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getTenantId() { return tenant == null ? null : tenant.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getExcludedByUserId() { return excludedByUser == null ? null : excludedByUser.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getBacklogItemId() { return backlogItem == null ? null : backlogItem.getId(); }

    public Long getArtifactId() { return artifact == null ? null : artifact.getId(); }
}
