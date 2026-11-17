package com.example.starter_project_2025.system.git_integration.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
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

    @Column(name = "tenant_id", nullable = false)
    Long tenantId;

    /** Master project of the repository. */
    @Column(name = "project_id", nullable = false)
    Long projectId;

    @Column(name = "repository_id", nullable = false)
    Long repositoryId;

    /** {@code sprint_backlog.sprint_backlog_id}. */
    @Column(name = "backlog_item_id", nullable = false)
    Long backlogItemId;

    /** Project (master or module) of the task when it was linked, for statistics per module. */
    @Column(name = "item_project_id")
    Long itemProjectId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "artifact_type", nullable = false, length = 20)
    GitArtifactType artifactType;

    /** {@code git_commits.id} or {@code git_pull_requests.id}. */
    @Column(name = "artifact_id", nullable = false)
    Long artifactId;

    /** Commit time, or pull request creation time: the order of the Task Detail timeline. */
    @Column(name = "artifact_at", nullable = false)
    LocalDateTime artifactAt;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "link_source", nullable = false, length = 10)
    BacklogLinkSource linkSource;

    /** The reference that produced an AUTO link. */
    @Column(name = "reference_id")
    Long referenceId;

    /** Who made a MANUAL link. */
    @Column(name = "linked_by_user_id")
    Long linkedByUserId;

    @Column(name = "linked_at", nullable = false)
    LocalDateTime linkedAt;
}
