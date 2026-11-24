package com.example.starter_project_2025.system.git_integration.webhook;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEvent;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEventStatus;
import com.example.starter_project_2025.system.git_integration.repository.GitWebhookEventRepository;
import com.example.starter_project_2025.system.git_integration.service.GitEntityReferences;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * SY-03 / SY-04: every write to {@code git_webhook_events}, each in a short
 * transaction of its own so no transaction (or row lock) is held while a handler
 * runs. Concurrent workers are kept apart by {@code SELECT … FOR UPDATE SKIP LOCKED}
 * when claiming, then by the PROCESSING status (the row's {@code @Version} stays
 * as a second guard).
 */
@Slf4j
@Service
public class GitWebhookEventStore {
    @Autowired
    private GitEntityReferences entityReferences;

    /** Wait before retry 1, 2, … 5 (the last value repeats if more retries are configured). */
    static final List<Duration> BACKOFF = List.of(Duration.ofMinutes(1), Duration.ofMinutes(5), Duration.ofMinutes(15),
            Duration.ofHours(1), Duration.ofHours(6));
    static final Set<GitWebhookEventStatus> RUNNABLE = EnumSet.of(GitWebhookEventStatus.RECEIVED,
            GitWebhookEventStatus.FAILED_RETRYABLE);
    static final Set<GitWebhookEventStatus> FINISHED = EnumSet.of(GitWebhookEventStatus.PROCESSED,
            GitWebhookEventStatus.IGNORED, GitWebhookEventStatus.FAILED);
    /** Waiting, running or retrying: shown as "pending" on the activity summary. */
    public static final Set<GitWebhookEventStatus> PENDING = EnumSet.of(GitWebhookEventStatus.RECEIVED,
            GitWebhookEventStatus.PROCESSING, GitWebhookEventStatus.FAILED_RETRYABLE);
    /** Event types SY-04 can replay; installation-level events are not. */
    public static final Set<String> REPLAYABLE_TYPES = Set.of("push", "pull_request", "pull_request_review");

    private final GitWebhookEventRepository events;
    private final ApplicationEventPublisher publisher;
    private final GitHubAppProperties properties;
    private final Clock clock;

    public GitWebhookEventStore(GitWebhookEventRepository events, ApplicationEventPublisher publisher,
                                GitHubAppProperties properties, @Qualifier("gitIntegrationClock") Clock clock) {
        this.events = events;
        this.publisher = publisher;
        this.properties = properties;
        this.clock = clock;
    }

    /** Routing data copied from the headers and the payload at receive time. */
    public record Incoming(String deliveryId, String eventType, String action, Long hookId, Long installationId,
                           Long repoExternalId, String repoFullName, String senderLogin, String payload, int payloadBytes,
                           boolean subscribed) {
    }

    /** What the processor resolved from the payload ids; written together with the outcome. */
    public record Resolution(Long tenantId, Long installationRef, Long repositoryRef) {
        public static final Resolution NONE = new Resolution(null, null, null);
    }

    public record Claimed(Long id, String deliveryId, String eventType, String action, Long installationId,
                          Long repoExternalId, String payload, int attempts, LocalDateTime receivedAt) {
    }

    /** One INSERT; publishes {@link GitWebhookEventReceived} for subscribed events (processed after commit). */
    @Transactional
    public GitWebhookEvent insert(Incoming incoming) {
        LocalDateTime now = now();
        GitWebhookEvent event = events.saveAndFlush(GitWebhookEvent.builder()
                .provider(GitProvider.GITHUB)
                .deliveryId(incoming.deliveryId())
                .eventType(incoming.eventType())
                .action(incoming.action())
                .hookId(incoming.hookId())
                .installationId(incoming.installationId())
                .repoExternalId(incoming.repoExternalId())
                .repoFullName(incoming.repoFullName())
                .senderLogin(incoming.senderLogin())
                .payload(incoming.payload())
                .payloadBytes(incoming.payloadBytes())
                .status(incoming.subscribed() ? GitWebhookEventStatus.RECEIVED : GitWebhookEventStatus.IGNORED)
                .lastError(incoming.subscribed() ? null : "Event type is not subscribed")
                .processedAt(incoming.subscribed() ? null : now)
                .nextAttemptAt(now)
                .receivedAt(now)
                .build());
        if (incoming.subscribed()) {
            publisher.publishEvent(new GitWebhookEventReceived(event.getId(), event.getEventType()));
        }
        return event;
    }

    /**
     * AC06: RECEIVED/FAILED_RETRYABLE + due + handled type → PROCESSING. The row is
     * locked with {@code FOR UPDATE SKIP LOCKED}: a worker racing for the same event
     * gets nothing back immediately and skips it. The lock ends with this short
     * transaction; from then on the PROCESSING status keeps other workers away.
     * Empty when the event is not runnable or another worker has it.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<Claimed> claim(Long id, Set<String> handledTypes) {
        LocalDateTime now = now();
        if (events.lockRunnable(id, now).isEmpty()) {
            return Optional.empty();
        }
        GitWebhookEvent event = events.findById(id).orElse(null);
        if (event == null || !RUNNABLE.contains(event.getStatus()) || !handledTypes.contains(event.getEventType())) {
            return Optional.empty();
        }
        event.setStatus(GitWebhookEventStatus.PROCESSING);
        event.setAttempts(event.getAttempts() + 1);
        event.setProcessingStartedAt(now);
        events.saveAndFlush(event);
        return Optional.of(new Claimed(event.getId(), event.getDeliveryId(), event.getEventType(), event.getAction(),
                event.getInstallationId(), event.getRepoExternalId(), event.getPayload(), event.getAttempts(),
                event.getReceivedAt()));
    }

    /** PROCESSED, or IGNORED with the handler's reason. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void finish(Long id, GitWebhookHandlerResult result, Resolution resolution) {
        events.findById(id).ifPresent(event -> {
            resolve(event, resolution);
            event.setStatus(result.handled() ? GitWebhookEventStatus.PROCESSED : GitWebhookEventStatus.IGNORED);
            event.setLastError(GitWebhookJson.limit(result.note(), 1000));
            event.setRecordsProcessed(result.handled() ? result.records() : null);
            event.setPartialResult(result.handled() && result.partial() ? Boolean.TRUE : null);
            event.setProcessedAt(now());
        });
    }

    /**
     * AC04: a transient failure becomes FAILED_RETRYABLE with backoff (at least
     * {@code retryAfterSeconds} when GitHub asked to wait), or FAILED once every retry
     * was used. A permanent failure is FAILED at once. Payload and row are kept.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(Long id, GitWebhookFailure failure, Resolution resolution) {
        events.findById(id).ifPresent(event -> {
            resolve(event, resolution);
            markFailed(event, failure);
        });
    }

    /** A permanent problem found before any handler ran (payload purged or unreadable): no retry. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void failPermanently(Long id, String reason) {
        events.findById(id).ifPresent(event -> markFailed(event, GitWebhookFailure.permanent(reason)));
    }

    public enum ReplayOutcome { QUEUED, NOT_FOUND, NOT_REPLAYABLE, PAYLOAD_PURGED }

    /**
     * SY-04: puts a FAILED event, or an IGNORED push / pull request / review event (for
     * example one that arrived before its repository was linked), back to RECEIVED with
     * a fresh retry budget and processes it right after commit. Only events of the
     * given tenant can be replayed.
     */
    @Transactional
    public ReplayOutcome replay(Long id, Long tenantId, Long actorUserId) {
        GitWebhookEvent event = events.findById(id).orElse(null);
        if (event == null || event.getTenantId() == null || !event.getTenantId().equals(tenantId)) {
            return ReplayOutcome.NOT_FOUND;
        }
        boolean replayable = event.getStatus() == GitWebhookEventStatus.FAILED
                || (event.getStatus() == GitWebhookEventStatus.IGNORED && REPLAYABLE_TYPES.contains(event.getEventType()));
        if (!replayable) {
            return ReplayOutcome.NOT_REPLAYABLE;
        }
        if (event.getPayload() == null) {
            return ReplayOutcome.PAYLOAD_PURGED;
        }
        LocalDateTime now = now();
        event.setStatus(GitWebhookEventStatus.RECEIVED);
        event.setAttempts(0);
        event.setNextAttemptAt(now);
        event.setProcessingStartedAt(null);
        event.setProcessedAt(null);
        event.setRecordsProcessed(null);
        event.setPartialResult(null);
        event.setLastError(GitWebhookJson.limit("Replayed by user #" + actorUserId, 1000));
        events.saveAndFlush(event);
        publisher.publishEvent(new GitWebhookEventReceived(event.getId(), event.getEventType()));
        log.info("Webhook event replayed: id={}, deliveryId={}, type={}, by user {}",
                event.getId(), event.getDeliveryId(), event.getEventType(), actorUserId);
        return ReplayOutcome.QUEUED;
    }

    /** PROCESSING events whose worker vanished count as a failed attempt. Returns how many. */
    @Transactional
    public int requeueStuck() {
        LocalDateTime before = now().minusMinutes(properties.getWebhookStuckAfterMinutes());
        List<Long> stuck = events.findStuckIds(GitWebhookEventStatus.PROCESSING, before, PageRequest.of(0, 50));
        stuck.forEach(id -> events.findById(id).ifPresent(event ->
                markFailed(event, GitWebhookFailure.retryable("The previous attempt did not finish", null))));
        return stuck.size();
    }

    @Transactional(readOnly = true)
    public List<Long> dueIds(Set<String> handledTypes, int limit) {
        if (handledTypes.isEmpty()) return List.of();
        LocalDateTime now = now();
        return events.findDueIds(handledTypes, GitWebhookEventStatus.RECEIVED, GitWebhookEventStatus.FAILED_RETRYABLE,
                now.minusSeconds(properties.getWebhookReceivedGraceSeconds()), now, PageRequest.of(0, limit));
    }

    /** Retention: drops payloads of finished events older than the configured days. */
    @Transactional
    public int purgePayloads() {
        LocalDateTime now = now();
        return events.purgePayloads(now.minusDays(properties.getWebhookPayloadRetentionDays()), now, FINISHED);
    }

    private void markFailed(GitWebhookEvent event, GitWebhookFailure failure) {
        event.setLastError(GitWebhookJson.limit(failure.getMessage(), 1000));
        int retriesUsed = Math.max(event.getAttempts() - 1, 0);
        if (!failure.isRetryable() || retriesUsed >= properties.getWebhookMaxRetries()) {
            event.setStatus(GitWebhookEventStatus.FAILED);
            event.setProcessedAt(now());
            log.warn("Webhook event failed for good: id={}, deliveryId={}, type={}, attempts={}, retryable={}, error={}",
                    event.getId(), event.getDeliveryId(), event.getEventType(), event.getAttempts(),
                    failure.isRetryable(), event.getLastError());
            return;
        }
        Duration wait = BACKOFF.get(Math.min(retriesUsed, BACKOFF.size() - 1));
        if (failure.getRetryAfterSeconds() != null && failure.getRetryAfterSeconds() > wait.toSeconds()) {
            wait = Duration.ofSeconds(failure.getRetryAfterSeconds());
        }
        event.setStatus(GitWebhookEventStatus.FAILED_RETRYABLE);
        event.setNextAttemptAt(now().plus(wait));
    }

    private void resolve(GitWebhookEvent event, Resolution resolution) {
        if (resolution == null) return;
        if (resolution.tenantId() != null) event.setTenant(entityReferences.get(Tenant.class, resolution.tenantId()));
        if (resolution.installationRef() != null) event.setInstallation(entityReferences.get(GitInstallation.class, resolution.installationRef()));
        if (resolution.repositoryRef() != null) event.setRepository(entityReferences.get(GitRepository.class, resolution.repositoryRef()));
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(java.time.temporal.ChronoUnit.MICROS);
    }
}
