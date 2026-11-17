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
 * SY-05: one Task ID mentioned by a commit or a pull request, with the verdict
 * (linked, invalid, outside the project) — or a single {@code MISSING} row when the
 * source mentions none. Every processed source has at least one row, which is how
 * {@code GitTaskLinkSweeper} finds the sources still to process.
 * <p>
 * {@code source_id} is polymorphic ({@code git_commits.id} or {@code git_pull_requests.id})
 * and, like the other Git tables, carries no foreign key.
 */
@Entity
@Table(
        name = "backlog_reference",
        uniqueConstraints = @UniqueConstraint(name = "uk_backlog_ref_source_key",
                columnNames = {"source_type", "source_id", "ref_key"}),
        indexes = {
                @Index(name = "idx_backlog_ref_project_status", columnList = "project_id, status"),
                @Index(name = "idx_backlog_ref_repo_source", columnList = "repository_id, source_type, source_id"),
                @Index(name = "idx_backlog_ref_item", columnList = "backlog_item_id")
        })
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BacklogReference extends BaseEntity {

    /** {@code ref_key} of the single row of a source without any Task ID. */
    public static final String NO_KEY = "";

    @Column(name = "tenant_id", nullable = false)
    Long tenantId;

    /** Master project of the repository when the source was processed. */
    @Column(name = "project_id", nullable = false)
    Long projectId;

    @Column(name = "repository_id", nullable = false)
    Long repositoryId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "source_type", nullable = false, length = 20)
    GitArtifactType sourceType;

    @Column(name = "source_id", nullable = false)
    Long sourceId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "source_field", nullable = false, length = 10)
    BacklogReferenceField sourceField;

    /** Normalized Task ID ({@code FA-21}); {@link #NO_KEY} for the MISSING row. */
    @Column(name = "ref_key", nullable = false, length = 30)
    String refKey;

    /** The Task ID as written ({@code fa-21}), for display. */
    @Column(name = "raw_text", length = 40)
    String rawText;

    /** The task found: set for LINKED and OUTSIDE_PROJECT (the latter is never shown to the other project). */
    @Column(name = "backlog_item_id")
    Long backlogItemId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 20)
    BacklogReferenceStatus status;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "reason", nullable = false, length = 30)
    BacklogReferenceReason reason;

    /** Last time the verdict was decided (a re-check updates it). */
    @Column(name = "resolved_at", nullable = false)
    LocalDateTime resolvedAt;
}
