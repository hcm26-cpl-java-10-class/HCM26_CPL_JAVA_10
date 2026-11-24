package com.example.starter_project_2025.system.git_integration.webhook;

/** SY-03: published in the transaction that stored a RECEIVED event; handled after commit. */
public record GitWebhookEventReceived(Long eventId, String eventType) {
}
