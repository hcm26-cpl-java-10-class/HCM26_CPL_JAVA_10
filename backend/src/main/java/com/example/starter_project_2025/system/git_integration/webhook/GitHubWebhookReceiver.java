package com.example.starter_project_2025.system.git_integration.webhook;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.repository.GitWebhookEventRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * SY-03: the synchronous part of a webhook delivery: verify the signature over the
 * raw bytes, de-duplicate on {@code X-GitHub-Delivery}, copy the routing fields
 * and store the event. No business processing happens here (GitHub expects an
 * answer within 10 seconds; the platform aims for 1).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GitHubWebhookReceiver {

    /** Events registered on the GitHub App. Anything else is stored as IGNORED. */
    public static final Set<String> SUBSCRIBED_EVENTS = Set.of(
            "push", "pull_request", "pull_request_review", "installation", "installation_repositories", "repository");

    private static final long SLOW_RECEIVE_MILLIS = 500;

    private final GitHubAppProperties properties;
    private final GitHubWebhookSignatureVerifier verifier;
    private final GitWebhookEventRepository events;
    private final GitWebhookEventStore store;
    private final ObjectMapper json;

    public enum Outcome { ACCEPTED, DUPLICATE }

    public Outcome receive(byte[] body, String signature, String deliveryId, String eventType, String hookId) {
        long started = System.nanoTime();
        if (!properties.webhooksEnabled()) {
            throw GitWebhookRejectedException.disabled();
        }
        if (signature == null || signature.isBlank()) {
            log.warn("Webhook rejected (no signature): deliveryId={}, event={}", deliveryId, eventType);
            throw GitWebhookRejectedException.signatureMissing();
        }
        byte[] raw = body == null ? new byte[0] : body;
        if (!verifier.verify(properties.getWebhookSecret(), raw, signature)) {
            // AC04: nothing is parsed or stored; the body is never logged.
            log.warn("Webhook rejected (bad signature): deliveryId={}, event={}", deliveryId, eventType);
            throw GitWebhookRejectedException.signatureInvalid();
        }
        if (deliveryId == null || deliveryId.isBlank() || deliveryId.length() > 64
                || eventType == null || eventType.isBlank() || eventType.length() > 50) {
            throw GitWebhookRejectedException.headersInvalid();
        }
        if (events.existsByProviderAndDeliveryId(GitProvider.GITHUB, deliveryId)) {
            log.info("Webhook duplicate ignored: deliveryId={}, event={}", deliveryId, eventType);
            return Outcome.DUPLICATE; // AC05
        }

        JsonNode root;
        try {
            root = json.readTree(raw);
        } catch (Exception e) {
            throw GitWebhookRejectedException.payloadInvalid();
        }
        if (root == null || !root.isObject()) {
            throw GitWebhookRejectedException.payloadInvalid();
        }

        GitWebhookEventStore.Incoming incoming = new GitWebhookEventStore.Incoming(
                deliveryId, eventType,
                GitWebhookJson.limit(GitWebhookJson.text(root, "action"), 50),
                parseLong(hookId),
                GitWebhookJson.number(root, "installation", "id"),
                GitWebhookJson.number(root, "repository", "id"),
                GitWebhookJson.limit(GitWebhookJson.text(root, "repository", "full_name"), 200),
                GitWebhookJson.limit(GitWebhookJson.text(root, "sender", "login"), 100),
                new String(raw, StandardCharsets.UTF_8),
                raw.length,
                SUBSCRIBED_EVENTS.contains(eventType));
        try {
            store.insert(incoming);
        } catch (DataIntegrityViolationException concurrentDelivery) {
            if (events.existsByProviderAndDeliveryId(GitProvider.GITHUB, deliveryId)) {
                return Outcome.DUPLICATE; // the same delivery arrived twice at the same time
            }
            throw concurrentDelivery;
        }

        long millis = (System.nanoTime() - started) / 1_000_000;
        if (millis > SLOW_RECEIVE_MILLIS) {
            log.warn("Slow webhook receive: deliveryId={}, event={}, bytes={}, {} ms", deliveryId, eventType, raw.length, millis);
        }
        log.info("Webhook received: deliveryId={}, event={}, action={}, installationId={}, repoId={}, bytes={}, {} ms",
                deliveryId, eventType, incoming.action(), incoming.installationId(), incoming.repoExternalId(), raw.length, millis);
        return Outcome.ACCEPTED;
    }

    private static Long parseLong(String value) {
        if (value == null) return null;
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
