package com.example.starter_project_2025.system.project.milestone.submission.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "milestone_submission_audit_logs", uniqueConstraints = {
        @UniqueConstraint(name = "uk_submission_action_actor_key",
                columnNames = {"submission_id", "action", "actor_id", "idempotency_key"})
}, indexes = {
        @Index(name = "idx_submission_audit", columnList = "submission_id,occurred_at")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SubmissionAuditLog {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "audit_id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "submission_id", nullable = false, updatable = false)
    private UUID submissionId;
    @Column(name = "submission_version_id", nullable = false, updatable = false)
    private UUID submissionVersionId;
    @Column(nullable = false, length = 50)
    private String action;
    @Column(name = "actor_id", nullable = false, updatable = false)
    private UUID actorId;
    @Column(name = "idempotency_key", length = 100)
    private String idempotencyKey;
    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    public static SubmissionAuditLog create(UUID submissionId, UUID versionId, String action,
                                            UUID actorId, String key, Instant now) {
        SubmissionAuditLog value = new SubmissionAuditLog();
        value.submissionId = submissionId;
        value.submissionVersionId = versionId;
        value.action = action;
        value.actorId = actorId;
        value.idempotencyKey = key;
        value.occurredAt = now;
        return value;
    }
}
