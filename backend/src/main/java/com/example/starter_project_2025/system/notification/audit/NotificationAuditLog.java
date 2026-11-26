package com.example.starter_project_2025.system.notification.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * Immutable audit log snapshot recording notification policy, template, and bulk-email actions.
 * Denormalized fields such as {@code actorEmail}, {@code beforeState}, and {@code afterState}
 * intentionally capture the state at the moment the event occurred and are not a source of truth
 * for current user or entity data.
 */
@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Table(
        name = "notification_audit_logs",
        indexes = {
                @Index(name = "idx_notif_audit_tenant_created", columnList = "tenant_id, created_at"),
                @Index(name = "idx_notif_audit_actor", columnList = "actor_id")
        }
)
public class NotificationAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "tenant_id")
    Long tenantId;

    @Column(name = "actor_id")
    Long actorId;

    @Column(name = "actor_email", length = 255)
    String actorEmail;

    @Column(nullable = false, length = 60)
    String action;

    @Column(name = "entity_type", length = 60)
    String entityType;

    @Column(name = "entity_id", length = 100)
    String entityId;

    @Column(name = "before_state", length = 1000)
    String beforeState;

    @Column(name = "after_state", length = 1000)
    String afterState;

    @Column(name = "correlation_id", length = 64)
    String correlationId;

    @Column(name = "created_at", nullable = false)
    LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
