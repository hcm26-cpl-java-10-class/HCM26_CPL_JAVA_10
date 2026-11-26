package com.example.starter_project_2025.system.notification.email;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.notification.NotificationCategory;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

/**
 * Outbox queue record and immutable delivery snapshot for outbound emails.
 * Fields such as {@code recipientEmail}, {@code templateCode}, {@code templateVersion},
 * {@code subject}, and {@code renderedBodyHtml} intentionally freeze the rendered content
 * and destination at enqueue time for audit history and safe retries.
 */
@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Table(
        name = "email_attempts",
        indexes = {
                @Index(name = "idx_email_attempt_queue", columnList = "delivery_status, next_retry_at"),
                @Index(name = "idx_email_attempt_tenant_created", columnList = "tenant_id, created_at"),
                @Index(name = "idx_email_attempt_context", columnList = "context_ref")
        },
        uniqueConstraints = @UniqueConstraint(
                name = "uk_email_attempt_idempotency",
                columnNames = {"idempotency_key"}
        )
)
public class EmailAttempt extends BaseEntity {

    @Column(name = "tenant_id")
    Long tenantId;

    @Column(name = "idempotency_key", nullable = false, updatable = false, length = 180)
    String idempotencyKey;

    @Column(name = "batch_id", length = 64)
    String batchId;

    @Column(name = "recipient_user_id")
    Long recipientUserId;

    @Column(name = "recipient_email", nullable = false, length = 320)
    String recipientEmail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    NotificationCategory category;

    @Column(name = "template_code", length = 100)
    String templateCode;

    @Column(name = "template_version")
    Integer templateVersion;

    @Column(name = "context_ref", length = 120)
    String contextRef;

    @Column(nullable = false, length = 255)
    String subject;

    @Column(name = "rendered_body_html", columnDefinition = "TEXT", nullable = false)
    String renderedBodyHtml;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "delivery_status", nullable = false, length = 30)
    EmailDeliveryStatus deliveryStatus = EmailDeliveryStatus.QUEUED;

    @Builder.Default
    @Column(name = "retry_count", nullable = false)
    int retryCount = 0;

    @Builder.Default
    @Column(name = "max_retries", nullable = false)
    int maxRetries = 3;

    @Column(name = "next_retry_at")
    LocalDateTime nextRetryAt;

    @Column(name = "sent_at")
    LocalDateTime sentAt;

    @Column(name = "last_error", length = 500)
    String lastError;

    @Column(name = "correlation_id", length = 64)
    String correlationId;

    @Column(name = "created_by_user_id")
    Long createdByUserId;
}
