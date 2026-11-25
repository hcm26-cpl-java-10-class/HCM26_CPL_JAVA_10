package com.example.starter_project_2025.system.git_integration.webhook.handler;

import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.service.GitRepositoryConnectionWriter;
import com.example.starter_project_2025.system.git_integration.service.GitRepositoryReason;
import com.example.starter_project_2025.system.git_integration.service.InstallationRepositoryCache;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookContext;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookEventHandler;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookHandlerResult;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookJson;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * SY-03: {@code repository} events for a linked repository keep the stored
 * snapshot current (rename, transfer, visibility) and GI-05: mark it DISCONNECTED
 * when it is deleted. The snapshot is refreshed for a DISCONNECTED connection too
 * (the processor resolves it for this event); repositories not linked are ignored.
 */
@Component
@RequiredArgsConstructor
public class RepositoryEventHandler implements GitWebhookEventHandler {

    private static final Set<String> SNAPSHOT_ACTIONS = Set.of("renamed", "transferred", "privatized", "publicized", "edited");

    private final GitRepositoryConnectionWriter connectionWriter;
    private final InstallationRepositoryCache cache;

    @Override
    public Set<String> eventTypes() {
        return Set.of("repository");
    }

    @Override
    public GitWebhookHandlerResult handle(GitWebhookContext context) {
        GitRepository connection = context.repository();
        if (connection == null) {
            return GitWebhookHandlerResult.ignored("Repository is not linked to a project");
        }
        String action = context.action() == null ? "" : context.action();
        if (context.installation() != null) {
            cache.evict(context.installation().getInstallationId()); // names/visibility in the browser list changed
        }
        if ("deleted".equals(action)) {
            boolean changed = connectionWriter.disconnect(connection.getId(), GitRepositoryReason.REPOSITORY_DELETED);
            return changed ? GitWebhookHandlerResult.processed("Repository connection disconnected")
                    : GitWebhookHandlerResult.ignored("Repository connection is " + connection.getStatus());
        }
        if (SNAPSHOT_ACTIONS.contains(action)) {
            JsonNode repository = GitWebhookJson.at(context.payload(), "repository");
            connectionWriter.refreshSnapshot(connection.getId(),
                    GitWebhookJson.text(repository, "owner", "login"),
                    GitWebhookJson.text(repository, "name"),
                    GitWebhookJson.text(repository, "full_name"),
                    GitWebhookJson.text(repository, "html_url"),
                    GitWebhookJson.text(repository, "visibility"),
                    GitWebhookJson.text(repository, "default_branch"));
            return GitWebhookHandlerResult.processed();
        }
        return GitWebhookHandlerResult.ignored("Unsupported action: " + action);
    }
}
