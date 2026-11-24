package com.example.starter_project_2025.system.git_integration.webhook;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * SY-03: what a handler receives. {@code installation} and {@code repository} are
 * resolved from the payload ids (null when the platform does not know them);
 * {@code repository} is the connection of {@code payload.repository.id} that receives events
 * (ACTIVE or ERROR; for {@code repository} events also a DISCONNECTED one, GI-05).
 */
public record GitWebhookContext(
        Long eventId,
        String deliveryId,
        String eventType,
        String action,
        int attempt,
        JsonNode payload,
        GitInstallation installation,
        GitRepository repository) {
}
