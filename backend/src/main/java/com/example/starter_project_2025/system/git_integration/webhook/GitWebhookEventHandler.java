package com.example.starter_project_2025.system.git_integration.webhook;

import java.util.Set;

/**
 * SY-03 extension point: processes stored webhook events of some types. One
 * handler per event type (checked at startup). SY-04 adds handlers for push,
 * pull_request and pull_request_review; until then those events wait as RECEIVED.
 * <p>
 * Handlers must be idempotent: an event may be processed again after a failure
 * or a lost worker, and GitHub does not guarantee delivery order.
 */
public interface GitWebhookEventHandler {

    /** {@code X-GitHub-Event} values handled, e.g. {@code installation}. */
    Set<String> eventTypes();

    GitWebhookHandlerResult handle(GitWebhookContext context);
}
