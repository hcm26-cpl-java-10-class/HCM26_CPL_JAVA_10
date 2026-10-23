package com.example.starter_project_2025.system.project.backlog_temp.audit;

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
 * Persistent audit trail for backlog item mutations
 * (UFR-PRJ-003-02, "Tính bất biến &amp; Workflow: thay đổi thông tin đều được
 * ghi log").
 * <p>
 * Every row captures the actor, the timestamp, the before/after state and the
 * correlation id of the originating request.
 */
@Entity
@Table(
        name = "task_audit_log",
        indexes = {
                @Index(name = "idx_task_audit_task", columnList = "task_id"),
                @Index(name = "idx_task_audit_correlation", columnList = "correlation_id")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TaskAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "task_id", nullable = false)
    Long taskId;

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
