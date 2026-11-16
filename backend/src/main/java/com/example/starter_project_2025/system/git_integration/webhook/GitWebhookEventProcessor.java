package com.example.starter_project_2025.system.git_integration.webhook;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * SY-03: processes one stored event: claim → read payload → resolve installation
 * and repository → run the handler → record the outcome. A handler exception
 * marks the event FAILED (retried with backoff) and never loses it (AC06).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GitWebhookEventProcessor {

    private final GitWebhookEventStore store;
    private final GitWebhookHandlerRegistry registry;
    private final GitInstallationRepository installations;
    private final GitRepositoryRepository connections;
    private final ObjectMapper json;

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
            store.fail(event.id(), "No handler for " + event.eventType(), GitWebhookEventStore.Resolution.NONE);
            return;
        }
        if (event.payload() == null) {
            store.dead(event.id(), "The payload was purged before the event could be processed");
            return;
        }
        JsonNode payload;
        try {
            payload = json.readTree(event.payload());
        } catch (Exception e) {
            store.dead(event.id(), "The stored payload is not valid JSON");
            return;
        }

        GitWebhookEventStore.Resolution resolution = GitWebhookEventStore.Resolution.NONE;
        try {
            GitInstallation installation = event.installationId() == null ? null
                    : installations.findByProviderAndInstallationId(GitProvider.GITHUB, event.installationId()).orElse(null);
            GitRepository repository = event.repoExternalId() == null ? null
                    : connections.findFirstByProviderAndExternalIdAndStatus(GitProvider.GITHUB, event.repoExternalId(),
                    GitRepositoryStatus.ACTIVE).orElse(null);
            Long tenantId = installation != null ? installation.getTenantId() : repository != null ? repository.getTenantId() : null;
            resolution = new GitWebhookEventStore.Resolution(tenantId,
                    installation == null ? null : installation.getId(), repository == null ? null : repository.getId());

            GitWebhookHandlerResult result = handler.handle(new GitWebhookContext(event.id(), event.deliveryId(),
                    event.eventType(), event.action(), event.attempts(), payload, installation, repository));
            store.finish(event.id(), result, resolution);
            log.info("Webhook event {}: id={}, deliveryId={}, type={}, action={}, note={}",
                    result.handled() ? "processed" : "ignored", event.id(), event.deliveryId(), event.eventType(),
                    event.action(), result.note());
        } catch (RuntimeException e) {
            log.warn("Webhook event failed: id={}, deliveryId={}, type={}, attempt={}, error={}",
                    event.id(), event.deliveryId(), event.eventType(), event.attempts(), e.toString());
            store.fail(event.id(), e.getClass().getSimpleName() + ": " + e.getMessage(), resolution);
        }
    }
}
