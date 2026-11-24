package com.example.starter_project_2025.system.auth.audit;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "auth_audit_logs",
        indexes = {
                @Index(name = "idx_auth_audit_created_at", columnList = "created_at"),
                @Index(name = "idx_auth_audit_actor", columnList = "actor_id"),
                @Index(name = "idx_auth_audit_action", columnList = "action")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AuthAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "tenant_id")
    Long tenantId;

    @Column(name = "actor_id")
    Long actorId;

    @Column(name = "actor_email", length = 255)
    String actorEmail;

    @Column(name = "target_user_id")
    Long targetUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 40)
    AuthAuditAction action;

    @Column(name = "ip_address", length = 64)
    String ipAddress;

    @Column(name = "user_agent", length = 512)
    String userAgent;

    @Column(name = "correlation_id", length = 64)
    String correlationId;

    @Column(name = "detail", length = 500)
    String detail;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;
}
