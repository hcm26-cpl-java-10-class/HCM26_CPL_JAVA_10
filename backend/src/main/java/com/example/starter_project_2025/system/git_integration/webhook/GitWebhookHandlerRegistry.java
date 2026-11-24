package com.example.starter_project_2025.system.git_integration.webhook;

import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** SY-03: event type → handler. Two handlers for one type fail the startup. */
@Component
public class GitWebhookHandlerRegistry {

    private final Map<String, GitWebhookEventHandler> byType = new HashMap<>();

    public GitWebhookHandlerRegistry(List<GitWebhookEventHandler> handlers) {
        for (GitWebhookEventHandler handler : handlers) {
            for (String type : handler.eventTypes()) {
                GitWebhookEventHandler previous = byType.putIfAbsent(type, handler);
                if (previous != null) {
                    throw new IllegalStateException("Two webhook handlers for '" + type + "': "
                            + previous.getClass().getSimpleName() + " and " + handler.getClass().getSimpleName());
                }
            }
        }
    }

    public Optional<GitWebhookEventHandler> find(String eventType) {
        return Optional.ofNullable(byType.get(eventType));
    }

    public boolean handles(String eventType) {
        return byType.containsKey(eventType);
    }

    public Set<String> handledTypes() {
        return Set.copyOf(byType.keySet());
    }
}
