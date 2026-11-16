package com.example.starter_project_2025.system.git_integration.webhook;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEvent;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEventStatus;
import com.example.starter_project_2025.system.git_integration.repository.GitWebhookEventRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * SY-03: every write to {@code git_webhook_events}, each in a short transaction
 * of its own so no transaction is held while a handler runs. Concurrent workers
 * are kept apart by the row's {@code @Version}.
 */
@Slf4j
@Service
public class GitWebhookEventStore {

    /** Wait before attempt 2, 3, … (the last value repeats). */
    static final List<Duration> BACKOFF = List.of(Duration.ofMinutes(1), Duration.ofMinutes(5), Duration.ofMinutes(15),
            Duration.ofHours(1), Duration.ofHours(6));
    static final Set<GitWebhookEventStatus> RUNNABLE = EnumSet.of(GitWebhookEventStatus.RECEIVED, GitWebhookEventStatus.FAILED);
    static final Set<GitWebhookEventStatus> FINISHED = EnumSet.of(GitWebhookEventStatus.PROCESSED,
            GitWebhookEventStatus.IGNORED, GitWebhookEventStatus.DEAD);

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
                          Long repoExternalId, String payload, int attempts) {
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

    /** RECEIVED/FAILED + due + handled type → PROCESSING. Empty when not runnable. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<Claimed> claim(Long id, Set<String> handledTypes) {
        GitWebhookEvent event = events.findById(id).orElse(null);
        LocalDateTime now = now();
        if (event == null || !RUNNABLE.contains(event.getStatus()) || event.getNextAttemptAt().isAfter(now)
                || !handledTypes.contains(event.getEventType())) {
            return Optional.empty();
        }
        event.setStatus(GitWebhookEventStatus.PROCESSING);
        event.setAttempts(event.getAttempts() + 1);
        event.setProcessingStartedAt(now);
        events.saveAndFlush(event); // optimistic lock: a concurrent claim fails here
        return Optional.of(new Claimed(event.getId(), event.getDeliveryId(), event.getEventType(), event.getAction(),
                event.getInstallationId(), event.getRepoExternalId(), event.getPayload(), event.getAttempts()));
    }

    /** PROCESSED, or IGNORED with the handler's reason. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void finish(Long id, GitWebhookHandlerResult result, Resolution resolution) {
        events.findById(id).ifPresent(event -> {
            resolve(event, resolution);
            event.setStatus(result.handled() ? GitWebhookEventStatus.PROCESSED : GitWebhookEventStatus.IGNORED);
            event.setLastError(GitWebhookJson.limit(result.note(), 1000));
            event.setProcessedAt(now());
        });
    }

    /** AC06: FAILED with backoff, or DEAD once every attempt was used. Payload and row are kept. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(Long id, String error, Resolution resolution) {
        events.findById(id).ifPresent(event -> {
            resolve(event, resolution);
            markFailed(event, error);
        });
    }

    /** A permanent problem (payload purged or unreadable): no retry. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void dead(Long id, String reason) {
        events.findById(id).ifPresent(event -> {
            event.setStatus(GitWebhookEventStatus.DEAD);
            event.setLastError(GitWebhookJson.limit(reason, 1000));
            event.setProcessedAt(now());
        });
    }

    /** PROCESSING events whose worker vanished count as a failed attempt. Returns how many. */
    @Transactional
    public int requeueStuck() {
        LocalDateTime before = now().minusMinutes(properties.getWebhookStuckAfterMinutes());
        List<Long> stuck = events.findStuckIds(GitWebhookEventStatus.PROCESSING, before, PageRequest.of(0, 50));
        stuck.forEach(id -> events.findById(id).ifPresent(event -> markFailed(event, "The previous attempt did not finish")));
        return stuck.size();
    }

    @Transactional(readOnly = true)
    public List<Long> dueIds(Set<String> handledTypes, int limit) {
        if (handledTypes.isEmpty()) return List.of();
        return events.findDueIds(RUNNABLE, handledTypes, now(), PageRequest.of(0, limit));
    }

    /** Retention: drops payloads of finished events older than the configured days. */
    @Transactional
    public int purgePayloads() {
        LocalDateTime now = now();
        return events.purgePayloads(now.minusDays(properties.getWebhookPayloadRetentionDays()), now, FINISHED);
    }

    private void markFailed(GitWebhookEvent event, String error) {
        event.setLastError(GitWebhookJson.limit(error, 1000));
        if (event.getAttempts() >= properties.getWebhookMaxAttempts()) {
            event.setStatus(GitWebhookEventStatus.DEAD);
            event.setProcessedAt(now());
            log.warn("Webhook event dead: id={}, deliveryId={}, type={}, attempts={}, error={}",
                    event.getId(), event.getDeliveryId(), event.getEventType(), event.getAttempts(), event.getLastError());
            return;
        }
        Duration wait = BACKOFF.get(Math.min(Math.max(event.getAttempts(), 1), BACKOFF.size()) - 1);
        event.setStatus(GitWebhookEventStatus.FAILED);
        event.setNextAttemptAt(now().plus(wait));
    }

    private static void resolve(GitWebhookEvent event, Resolution resolution) {
        if (resolution == null) return;
        if (resolution.tenantId() != null) event.setTenantId(resolution.tenantId());
        if (resolution.installationRef() != null) event.setInstallationRef(resolution.installationRef());
        if (resolution.repositoryRef() != null) event.setRepositoryRef(resolution.repositoryRef());
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }
}
