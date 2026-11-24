package com.example.starter_project_2025.system.git_integration.webhook.handler;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import com.example.starter_project_2025.system.git_integration.service.GitInstallationWriter;
import com.example.starter_project_2025.system.git_integration.service.GitRepositoryConnectionWriter;
import com.example.starter_project_2025.system.git_integration.service.GitRepositoryReason;
import com.example.starter_project_2025.system.git_integration.service.InstallationRepositoryCache;
import com.example.starter_project_2025.system.git_integration.sync.GitSyncJobQueue;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookContext;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookEventHandler;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookHandlerResult;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookJson;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Set;

/**
 * SY-03 AC07: the owner changed which repositories the app may access. The
 * repository list cache is dropped (GI-03 shows the change at once).
 * GI-05: a linked repository that was removed becomes DISCONNECTED (it stays the
 * project's repository, so the PM is warned to grant access again); one that is
 * added back becomes ACTIVE again and a synchronization fills the gap.
 */
@Component
public class InstallationRepositoriesEventHandler implements GitWebhookEventHandler {

    private final GitInstallationWriter installationWriter;
    private final GitRepositoryConnectionWriter connectionWriter;
    private final InstallationRepositoryCache cache;
    private final GitSyncJobQueue queue;
    private final Clock clock;

    public InstallationRepositoriesEventHandler(GitInstallationWriter installationWriter,
                                                GitRepositoryConnectionWriter connectionWriter,
                                                InstallationRepositoryCache cache, GitSyncJobQueue queue,
                                                @Qualifier("gitIntegrationClock") Clock clock) {
        this.installationWriter = installationWriter;
        this.connectionWriter = connectionWriter;
        this.cache = cache;
        this.queue = queue;
        this.clock = clock;
    }

    @Override
    public Set<String> eventTypes() {
        return Set.of("installation_repositories");
    }

    @Override
    @Transactional
    public GitWebhookHandlerResult handle(GitWebhookContext context) {
        GitInstallation installation = context.installation();
        if (installation == null) {
            return GitWebhookHandlerResult.ignored("Unknown installation");
        }
        installationWriter.updateRepositorySelection(installation.getId(),
                GitWebhookJson.text(context.payload(), "repository_selection"));
        cache.evict(installation.getInstallationId());

        int disconnected = 0;
        for (Long externalId : ids(context.payload(), "repositories_removed")) {
            if (connectionWriter.disconnect(installation.getId(), externalId, GitRepositoryReason.REPOSITORY_ACCESS_REMOVED)) {
                disconnected++;
            }
        }
        int reconnected = 0;
        for (Long externalId : ids(context.payload(), "repositories_added")) {
            var connection = connectionWriter.reconnect(installation.getId(), externalId);
            if (connection.isPresent()) {
                queue.request(connection.get().getId(), GitSyncJobType.WEBHOOK, null, LocalDateTime.now(clock));
                reconnected++;
            }
        }
        return GitWebhookHandlerResult.processed(disconnected + " repository connection(s) disconnected, "
                + reconnected + " reconnected");
    }

    private static java.util.List<Long> ids(JsonNode payload, String field) {
        JsonNode list = GitWebhookJson.at(payload, field);
        if (list == null || !list.isArray()) return java.util.List.of();
        java.util.List<Long> ids = new java.util.ArrayList<>();
        for (JsonNode repository : list) {
            Long id = GitWebhookJson.number(repository, "id");
            if (id != null) ids.add(id);
        }
        return ids;
    }
}
