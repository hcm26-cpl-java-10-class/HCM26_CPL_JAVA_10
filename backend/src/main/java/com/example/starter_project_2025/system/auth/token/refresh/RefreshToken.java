package com.example.starter_project_2025.system.auth.token.refresh;

import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "refresh_token",
        indexes = {
                @Index(name = "idx_refresh_token_hash", columnList = "tokenHash"),
                @Index(name = "idx_refresh_token_expiry", columnList = "expiryDate"),
                @Index(name = "idx_refresh_token_session", columnList = "session_id")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(nullable = false, unique = true, length = 512)
    String tokenHash;

    @Column(name = "session_id", length = 64)
    String sessionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "userId", nullable = false)
    User user;

    @Column(nullable = false)
    Instant expiryDate;

    boolean revoked;

    @Builder.Default
    @Column(name = "remember_me", nullable = false)
    @ColumnDefault("false")
    boolean rememberMe = false;

    @Column(name = "ip_address", length = 64)
    String ipAddress;

    @Column(name = "user_agent", length = 512)
    String userAgent;

    @Column(name = "last_used_at")
    Instant lastUsedAt;

    @Column(name = "revoked_reason", length = 120)
    String revokedReason;

    @CreationTimestamp
    @Column(updatable = false, nullable = false)
    protected LocalDateTime createdAt;
}
