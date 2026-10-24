package com.example.starter_project_2025.system.project.project_template_version.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Persistent audit trail for project template version mutations.
 * <p>
 * Every row captures the actor, the timestamp, the before/after state and the
 * correlation id of the originating request.
 */
@Entity
@Table(
        name = "project_template_version_audit_log",
        indexes = {
                @Index(name = "idx_ptv_audit_snapshot", columnList = "snapshot_id"),
                @Index(name = "idx_ptv_audit_correlation", columnList = "correlation_id")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProjectTemplateSnapshotAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "snapshot_id", nullable = false)
    Long snapshotId;

    @Column(name = "template_id")
    Long templateId;

    @Column(name = "project_id")
    Long projectId;

    @Column(nullable = false, length = 20)
    String action;

    @Column(name = "actor_id")
    Long actorId;

    @Column(name = "actor_email", length = 255)
    String actorEmail;

    @Column(name = "correlation_id", length = 100)
    String correlationId;

    @Column(name = "before_state", columnDefinition = "TEXT")
    String beforeState;

    @Column(name = "after_state", columnDefinition = "TEXT")
    String afterState;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;
}
