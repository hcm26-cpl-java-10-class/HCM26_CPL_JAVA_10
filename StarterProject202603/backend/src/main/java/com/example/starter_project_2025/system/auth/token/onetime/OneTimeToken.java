package com.example.starter_project_2025.system.auth.token.onetime;

import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "one_time_tokens",
        indexes = {@Index(name = "idx_one_time_token_hash", columnList = "tokenHash"),
                @Index(name = "idx_one_time_token_expiry", columnList = "expiryDate")})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class OneTimeToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(nullable = false, unique = true, length = 256)
    String tokenHash;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "userId", nullable = false)
    User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    TokenType type;

    @Column(nullable = false)
    Instant expiryDate;

    boolean used;

    @CreationTimestamp
    @Column(updatable = false, nullable = false)
    protected LocalDateTime createdAt;

    public enum TokenType {
        EMAIL_VERIFY,
        RESET_PASSWORD
    }
}
