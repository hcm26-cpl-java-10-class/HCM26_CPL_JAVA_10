package com.example.starter_project_2025.system.git_integration.webhook.handler;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.service.GitInstallationWriter;
import com.example.starter_project_2025.system.git_integration.service.GitRepositoryConnectionWriter;
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
 * SY-03 AC07: the owner changed which repositories the app may access. The
 * repository list cache is dropped (GI-03 shows the change at once) and a linked
 * repository that was removed becomes UNAVAILABLE, which frees its master project.
 */
@Component
@RequiredArgsConstructor
public class InstallationRepositoriesEventHandler implements GitWebhookEventHandler {

    private final GitInstallationWriter installationWriter;
    private final GitRepositoryConnectionWriter connectionWriter;
    private final InstallationRepositoryCache cache;

    @Override
    public Set<String> eventTypes() {
        return Set.of("installation_repositories");
    }

    @Override
    public GitWebhookHandlerResult handle(GitWebhookContext context) {
        GitInstallation installation = context.installation();
        if (installation == null) {
            return GitWebhookHandlerResult.ignored("Unknown installation");
        }
        installationWriter.updateRepositorySelection(installation.getId(),
                GitWebhookJson.text(context.payload(), "repository_selection"));
        cache.evict(installation.getInstallationId());

        int unavailable = 0;
        JsonNode removed = GitWebhookJson.at(context.payload(), "repositories_removed");
        if (removed != null && removed.isArray()) {
            for (JsonNode repository : removed) {
                Long externalId = GitWebhookJson.number(repository, "id");
                if (externalId != null && connectionWriter.markUnavailable(installation.getId(), externalId, "REPOSITORY_ACCESS_REMOVED")) {
                    unavailable++;
                }
            }
        }
        return GitWebhookHandlerResult.processed(unavailable + " repository connection(s) marked unavailable");
    }
}
