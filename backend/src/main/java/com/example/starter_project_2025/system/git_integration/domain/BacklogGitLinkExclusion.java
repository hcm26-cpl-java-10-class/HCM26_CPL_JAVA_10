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

    @Column(name = "tenant_id", nullable = false)
    Long tenantId;

    @Column(name = "backlog_item_id", nullable = false)
    Long backlogItemId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "artifact_type", nullable = false, length = 20)
    GitArtifactType artifactType;

    @Column(name = "artifact_id", nullable = false)
    Long artifactId;

    @Column(name = "excluded_by_user_id", nullable = false)
    Long excludedByUserId;

    @Column(name = "excluded_at", nullable = false)
    LocalDateTime excludedAt;
}
