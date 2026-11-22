package com.example.starter_project_2025.system.git_integration.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * SY-03: one webhook delivery received from GitHub, stored only after its
 * {@code X-Hub-Signature-256} was verified. It is the audit trail (payload kept
 * at least 30 days) and the work queue for asynchronous processing (SY-04).
 * <p>
 * Routing columns ({@code event_type}, {@code action}, {@code installation_id},
 * {@code repo_external_id}, {@code sender_login}) are copied out of the payload
 * at receive time so events can be filtered and traced without parsing JSON.
 * {@code tenant_id} / {@code installation_ref} / {@code repository_ref} are
 * resolved later by the processor (receiving must answer GitHub within 1 second).
 */
@Entity
@Table(
        name = "git_webhook_events",
        uniqueConstraints = @UniqueConstraint(name = "uk_git_webhook_delivery", columnNames = {"provider", "delivery_id"}),
        indexes = {
                @Index(name = "idx_git_webhook_due", columnList = "status, next_attempt_at"),
                @Index(name = "idx_git_webhook_installation", columnList = "installation_id, received_at"),
                @Index(name = "idx_git_webhook_repository", columnList = "repo_external_id, received_at"),
                @Index(name = "idx_git_webhook_received", columnList = "received_at"),
                @Index(name = "idx_git_webhook_repository_ref", columnList = "repository_ref, received_at")
        })
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GitWebhookEvent extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, length = 20)
    GitProvider provider;

    /** {@code X-GitHub-Delivery}: unique per delivery, identical when GitHub redelivers (AC05). */
    @Column(name = "delivery_id", nullable = false, length = 64)
    String deliveryId;

    /** {@code X-GitHub-Event}, e.g. push, pull_request, installation. */
    @Column(name = "event_type", nullable = false, length = 50)
    String eventType;

    /** {@code payload.action}, e.g. opened, closed, deleted; NULL for push. */
    @Column(name = "action", length = 50)
    String action;

    /** {@code X-GitHub-Hook-ID}: the webhook configuration that sent it (diagnostics). */
    @Column(name = "hook_id")
    Long hookId;

    /** {@code payload.installation.id}: GitHub's installation id (not {@code git_installations.id}). */
    @Column(name = "installation_id")
    Long installationId;

    /** {@code payload.repository.id}: GitHub's numeric repository id; NULL for installation-level events. */
    @Column(name = "repo_external_id")
    Long repoExternalId;

    /** {@code payload.repository.full_name} at delivery time (repositories can be renamed). */
    @Column(name = "repo_full_name", length = 200)
    String repoFullName;

    /** {@code payload.sender.login}: the GitHub user who triggered the event. */
    @Column(name = "sender_login", length = 100)
    String senderLogin;

    /** Resolved by the processor: the tenant owning the installation. */
    @Column(name = "tenant_id")
    Long tenantId;

    /** Resolved by the processor: {@code git_installations.id}. */
    @Column(name = "installation_ref")
    Long installationRef;

    /** Resolved by the processor: {@code git_repositories.id} of the ACTIVE connection, if any. */
    @Column(name = "repository_ref")
    Long repositoryRef;

    /** The verified request body, exactly as received (UTF-8 JSON). NULL once purged after the retention period. */
    @Lob
    @Column(name = "payload")
    String payload;

    @Column(name = "payload_bytes", nullable = false)
    Integer payloadBytes;

    @Column(name = "payload_purged_at")
    LocalDateTime payloadPurgedAt;

    /** VARCHAR, not a native ENUM, so new states never need a column change (SY-04). */
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 20)
    GitWebhookEventStatus status;

    /** Processing runs so far; {@code retry_count} in US-SY-04 terms is {@code attempts - 1}. */
    @Builder.Default
    @Column(name = "attempts", nullable = false)
    Integer attempts = 0;

    /** When a RECEIVED/FAILED_RETRYABLE event may be (re)tried ({@code next_retry_at} in US-SY-04). */
    @Column(name = "next_attempt_at", nullable = false)
    LocalDateTime nextAttemptAt;

    /** Sanitized reason of the last failure (or why it was IGNORED). */
    @Column(name = "last_error", length = 1000)
    String lastError;

    @Column(name = "received_at", nullable = false)
    LocalDateTime receivedAt;

    @Column(name = "processing_started_at")
    LocalDateTime processingStartedAt;

    @Column(name = "processed_at")
    LocalDateTime processedAt;

    /** SY-06: Git records (commits, pull requests, reviews) processed; NULL = not a data event, or before SY-06. */
    @Column(name = "records_processed")
    Integer recordsProcessed;

    /** SY-06: processed, but some records could not be read (push truncated). NULL = no. */
    @Column(name = "partial_result")
    Boolean partialResult;

    @Version
    @Column(name = "version")
    Long version;
}
