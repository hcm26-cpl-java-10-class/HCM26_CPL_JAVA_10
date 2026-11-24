package com.example.starter_project_2025.system.git_integration.webhook;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.service.GitHubFailures;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Component;

/**
 * SY-03 / SY-04: processes one stored event: claim (SKIP LOCKED) → read payload →
 * resolve installation and repository connection (ACTIVE / ERROR, GI-05) → run the handler →
 * record the outcome. Failures are classified for the retry policy (AC04): GitHub
 * network/5xx/rate-limit errors and unexpected errors are retried with backoff;
 * a missing permission or a removed installation fails the event at once.
 */
@Slf4j
@Component
public class GitWebhookEventProcessor {

    private final GitWebhookEventStore store;
    private final GitWebhookHandlerRegistry registry;
    private final GitInstallationRepository installations;
    private final GitRepositoryRepository connections;
    private final GitHubFailures gitHubFailures;
    private final ObjectMapper json;
    private final Clock clock;

    public GitWebhookEventProcessor(GitWebhookEventStore store, GitWebhookHandlerRegistry registry,
                                    GitInstallationRepository installations, GitRepositoryRepository connections,
                                    GitHubFailures gitHubFailures, ObjectMapper json,
                                    @Qualifier("gitIntegrationClock") Clock clock) {
        this.store = store;
        this.registry = registry;
        this.installations = installations;
        this.connections = connections;
        this.gitHubFailures = gitHubFailures;
        this.json = json;
        this.clock = clock;
    }

    public void process(Long eventId) {
        Optional<GitWebhookEventStore.Claimed> claimed;
        try {
            claimed = store.claim(eventId, registry.handledTypes());
        } catch (OptimisticLockingFailureException concurrentClaim) {
            return; // another worker took it
        }
        claimed.ifPresent(this::run);
    }

    private void run(GitWebhookEventStore.Claimed event) {
        GitWebhookEventHandler handler = registry.find(event.eventType()).orElse(null);
        if (handler == null) {
            store.fail(event.id(), GitWebhookFailure.retryable("No handler for " + event.eventType(), null),
                    GitWebhookEventStore.Resolution.NONE);
            return;
        }
        if (event.payload() == null) {
            store.failPermanently(event.id(), "The payload was purged before the event could be processed");
            return;
        }
        JsonNode payload;
        try {
            payload = json.readTree(event.payload());
        } catch (Exception e) {
            store.failPermanently(event.id(), "The stored payload is not valid JSON");
            return;
        }

        GitWebhookEventStore.Resolution resolution = GitWebhookEventStore.Resolution.NONE;
        GitInstallation installation = null;
        try {
            installation = event.installationId() == null ? null
                    : installations.findByProviderAndInstallationId(GitProvider.GITHUB, event.installationId()).orElse(null);
            GitRepository repository = resolveRepository(event.eventType(), event.repoExternalId(), installation);
            Long tenantId = installation != null ? installation.getTenantId() : repository != null ? repository.getTenantId() : null;
            resolution = new GitWebhookEventStore.Resolution(tenantId,
                    installation == null ? null : installation.getId(), repository == null ? null : repository.getId());

            GitWebhookHandlerResult result = handler.handle(new GitWebhookContext(event.id(), event.deliveryId(),
                    event.eventType(), event.action(), event.attempts(), payload, installation, repository));
            store.finish(event.id(), result, resolution);
            log.info("Webhook event {}: id={}, deliveryId={}, type={}, action={}, attempt={}, latencyMs={}, note={}",
                    result.handled() ? "processed" : "ignored", event.id(), event.deliveryId(), event.eventType(),
                    event.action(), event.attempts(), latencyMillis(event.receivedAt()), result.note());
        } catch (RuntimeException e) {
            GitWebhookFailure failure = classify(e, installation);
            log.warn("Webhook event attempt failed: id={}, deliveryId={}, type={}, attempt={}, retryable={}, error={}",
                    event.id(), event.deliveryId(), event.eventType(), event.attempts(), failure.isRetryable(),
                    failure.getMessage());
            store.fail(event.id(), failure, resolution);
        }
    }

    private GitWebhookFailure classify(RuntimeException e, GitInstallation installation) {
        if (e instanceof GitWebhookFailure failure) {
            return failure;
        }
        if (e instanceof GitHubApiException api) {
            if (installation != null) {
                // GONE / SUSPENDED update the installation; a 401 drops the cached token.
                gitHubFailures.toBusinessError(installation, api, "webhook");
            }
            return switch (api.getKind()) {
                case UNAVAILABLE -> GitWebhookFailure.retryable(api.getMessage(), null, api);
                case RATE_LIMITED -> GitWebhookFailure.retryable(api.getMessage(), api.getRetryAfterSeconds(), api);
                case GONE -> GitWebhookFailure.permanent("The GitHub App was uninstalled: " + api.getMessage(), api);
                case SUSPENDED -> GitWebhookFailure.permanent("The GitHub App installation is suspended: " + api.getMessage(), api);
                case REJECTED -> api.getHttpStatus() == 401
                        ? GitWebhookFailure.retryable(api.getMessage(), null, api)
                        : GitWebhookFailure.permanent(api.getMessage()
                        + " (check that the GitHub App has read access to Contents and Pull requests)", api);
            };
        }
        // Database hiccups and unexpected errors: retry; a fixed bug is picked up by the next attempt.
        return GitWebhookFailure.retryable(e.getClass().getSimpleName() + ": " + e.getMessage(), null, e);
    }

    private long latencyMillis(LocalDateTime receivedAt) {
        return receivedAt == null ? -1 : Duration.between(receivedAt, LocalDateTime.now(clock)).toMillis();
    }

    /**
     * GI-05: the connection an event is about. Only a connection that still receives events (ACTIVE
     * or ERROR) is synchronized: events of an unlinked (INACTIVE) repository are ignored. A
     * {@code repository} event (rename, transfer, deletion) also reaches a DISCONNECTED connection
     * read through the sending installation, so its name stays current.
     */
    private GitRepository resolveRepository(String eventType, Long repoExternalId, GitInstallation installation) {
        if (repoExternalId == null) return null;
        GitRepository receiving = connections.findReceiving(GitProvider.GITHUB, repoExternalId).orElse(null);
        if (receiving != null || !"repository".equals(eventType) || installation == null) return receiving;
        return connections.findByInstallation_IdAndExternalIdAndStatusIn(installation.getId(), repoExternalId,
                        java.util.EnumSet.of(GitRepositoryStatus.DISCONNECTED)).stream()
                .max(java.util.Comparator.comparing(GitRepository::getId))
                .orElse(null);
    }
}
