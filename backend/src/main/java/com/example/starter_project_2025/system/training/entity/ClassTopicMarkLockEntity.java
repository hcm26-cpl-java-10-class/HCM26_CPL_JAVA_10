package com.example.starter_project_2025.system.training.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(
        name = "class_topic_mark_locks",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_class_topic_mark_lock",
                columnNames = {"class_id", "topic_code"}
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassTopicMarkLockEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "class_id", nullable = false)
    private Long classId;

    @Column(name = "topic_code", nullable = false, length = 100)
    private String topicCode;

    @Column(name = "locked", nullable = false)
    private Boolean locked;

    @Column(name = "pin_hash", length = 255)
    private String pinHash;

    @Column(name = "failed_attempts", nullable = false)
    private Integer failedAttempts;

    @Column(name = "lockout_tier", nullable = false)
    private Integer lockoutTier;

    @Column(name = "cooldown_until")
    private Instant cooldownUntil;

    @Column(name = "locked_by", length = 255)
    private String lockedBy;

    @Column(name = "locked_at", length = 64)
    private String lockedAt;

    @Column(name = "unlocked_at", length = 64)
    private String unlockedAt;

    @Version
    private Long version;
}
