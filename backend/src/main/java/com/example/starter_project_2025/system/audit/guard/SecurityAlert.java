package com.example.starter_project_2025.system.audit.guard;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * A suspicious-activity warning raised by {@link RequestAbuseDetector} and reviewed by an admin.
 */
@Entity
@Table(name = "security_alerts", indexes = {
        @Index(name = "idx_security_alert_status", columnList = "status, last_seen_at"),
        @Index(name = "idx_security_alert_subject", columnList = "subject_key, type, status")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SecurityAlert {

    public static final String TYPE_RATE_LIMIT = "RATE_LIMIT";
    public static final String TYPE_REPEATED_DENIED = "REPEATED_DENIED";

    public static final String STATUS_OPEN = "OPEN";
    public static final String STATUS_DISMISSED = "DISMISSED";
    public static final String STATUS_BLOCKED = "BLOCKED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 30)
    private String type;

    @Column(nullable = false, length = 20)
    private String status;

    /** "user:email" for an authenticated caller, "ip:addr" otherwise. */
    @Column(name = "subject_key", nullable = false, length = 255)
    private String subjectKey;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "user_email", length = 255)
    private String userEmail;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Column(name = "request_count", nullable = false)
    private int requestCount;

    @Column(name = "window_seconds", nullable = false)
    private int windowSeconds;

    @Column(name = "last_path", length = 255)
    private String lastPath;

    /** How many times this same alert was triggered again while still open. */
    @Column(nullable = false)
    private int hits;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "last_seen_at", nullable = false)
    private LocalDateTime lastSeenAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "resolved_by", length = 255)
    private String resolvedBy;
}
