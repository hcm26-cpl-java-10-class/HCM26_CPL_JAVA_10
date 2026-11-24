package com.example.starter_project_2025.system.git_integration.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.project.domain.Project;
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
import org.hibernate.annotations.Formula;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * SY-05: N–N link between a backlog item (task) and a commit or a pull request.
 * Only valid links live here, so Task Detail and statistics read a small, clean table;
 * the failures stay in {@link BacklogReference}. A link never changes the task itself
 * (AC05: no automatic move to Done).
 */
@Entity
@Table(
        name = "backlog_git_link",
        uniqueConstraints = @UniqueConstraint(name = "uk_backlog_git_link",
                columnNames = {"backlog_item_id", "artifact_type", "artifact_id"}),
        indexes = {
                @Index(name = "idx_bgl_item_time", columnList = "backlog_item_id, artifact_type, artifact_at"),
                @Index(name = "idx_bgl_artifact", columnList = "artifact_type, artifact_id"),
                @Index(name = "idx_bgl_project", columnList = "project_id, artifact_type"),
                @Index(name = "idx_bgl_reference", columnList = "reference_id")
        })
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BacklogGitLink extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_backloggitlink_tenant_id"))
    Tenant tenant;

    /** Master project of the repository. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_backloggitlink_project_id"))
    Project project;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "repository_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_backloggitlink_repository_id"))
    GitRepository repository;

    /** {@code sprint_backlog.sprint_backlog_id}. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "backlog_item_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_gi_backloggitlink_backlog_item_id"))
    SprintBacklog backlogItem;

    /** Project (master or module) of the task when it was linked, for statistics per module. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_project_id",
            foreignKey = @ForeignKey(name = "fk_gi_backloggitlink_item_project_id"))
    Project itemProject;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "artifact_type", nullable = false, length = 20, insertable = false, updatable = false)
    GitArtifactType artifactType;

    /** {@code git_commits.id} or {@code git_pull_requests.id}. */
    @Any(fetch = FetchType.LAZY)
    @AnyKeyJavaClass(Long.class)
    @AnyDiscriminatorValue(discriminator = "COMMIT", entity = GitCommit.class)
    @AnyDiscriminatorValue(discriminator = "PULL_REQUEST", entity = GitPullRequest.class)
    @Column(name = "artifact_type", nullable = false, length = 20)
    @JoinColumn(name = "artifact_id", nullable = false)
    GitArtifact artifact;

    /** Read-only expression for Criteria predicates on a polymorphic relationship. */
    @Formula("artifact_id")
    @Setter(AccessLevel.NONE)
    Long artifactKey;

    /** Commit time, or pull request creation time: the order of the Task Detail timeline. */
    @Column(name = "artifact_at", nullable = false)
    LocalDateTime artifactAt;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "link_source", nullable = false, length = 10)
    BacklogLinkSource linkSource;

    /** The reference that produced an AUTO link. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reference_id",
            foreignKey = @ForeignKey(name = "fk_gi_backloggitlink_reference_id"))
    BacklogReference reference;

    /** Who made a MANUAL link. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "linked_by_user_id",
            foreignKey = @ForeignKey(name = "fk_gi_backloggitlink_linked_by_user_id"))
    User linkedByUser;

    @Column(name = "linked_at", nullable = false)
    LocalDateTime linkedAt;

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getTenantId() { return tenant == null ? null : tenant.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getProjectId() { return project == null ? null : project.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getRepositoryId() { return repository == null ? null : repository.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getLinkedByUserId() { return linkedByUser == null ? null : linkedByUser.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getBacklogItemId() { return backlogItem == null ? null : backlogItem.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getItemProjectId() { return itemProject == null ? null : itemProject.getId(); }

    /** ID exposed to existing DTOs; the entity owns an object relationship. */
    public Long getReferenceId() { return reference == null ? null : reference.getId(); }

    public Long getArtifactId() { return artifact == null ? null : artifact.getId(); }

    public void confirmManual(User actor, LocalDateTime at) {
        linkSource = BacklogLinkSource.MANUAL;
        reference = null;
        linkedByUser = actor;
        linkedAt = at;
    }
}
