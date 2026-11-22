package com.example.starter_project_2025.system.git_integration.webhook.handler;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.service.GitInstallationReason;
import com.example.starter_project_2025.system.git_integration.service.GitInstallationWriter;
import com.example.starter_project_2025.system.git_integration.service.GitRepositoryReason;
import com.example.starter_project_2025.system.git_integration.service.GitRepositoryConnectionWriter;
import com.example.starter_project_2025.system.git_integration.service.InstallationRepositoryCache;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookContext;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookEventHandler;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookHandlerResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.Set;

/**
 * SY-03 AC07: {@code installation} events keep {@code git_installations.status}
 * in step with GitHub (transitions T4/T5/T6 of GI-01 §9). Unknown installations
 * are ignored: they are created only through the Connect GitHub callback.
 */
@Component
@RequiredArgsConstructor
public class InstallationEventHandler implements GitWebhookEventHandler {

    private final GitInstallationWriter installationWriter;
    private final GitRepositoryConnectionWriter connectionWriter;
    private final InstallationTokenProvider tokens;
    private final InstallationRepositoryCache cache;

    @Override
    public Set<String> eventTypes() {
        return Set.of("installation");
    }

    @Override
    public GitWebhookHandlerResult handle(GitWebhookContext context) {
        GitInstallation installation = context.installation();
        if (installation == null) {
            return GitWebhookHandlerResult.ignored("Unknown installation");
        }
        String action = context.action() == null ? "" : context.action();
        return switch (action) {
            case "deleted" -> {
                // T6: the app was uninstalled; linked repositories can no longer be read.
                installationWriter.transition(installation.getId(),
                        EnumSet.of(GitInstallationStatus.CONNECTED, GitInstallationStatus.SUSPENDED, GitInstallationStatus.ERROR),
                        GitInstallationStatus.DISCONNECTED, GitInstallationReason.UNINSTALLED);
                int repositories = connectionWriter.disconnectByInstallation(installation.getId(), GitRepositoryReason.INSTALLATION_DELETED);
                forget(installation);
                yield GitWebhookHandlerResult.processed(repositories + " repository connection(s) disconnected");
            }
            case "suspend" -> {
                boolean changed = installationWriter.transition(installation.getId(),
                        EnumSet.of(GitInstallationStatus.CONNECTED, GitInstallationStatus.ERROR),
                        GitInstallationStatus.SUSPENDED, GitInstallationReason.SUSPENDED_ON_GITHUB);
                forget(installation);
                yield changed ? GitWebhookHandlerResult.processed()
                        : GitWebhookHandlerResult.ignored("Installation is " + installation.getStatus());
            }
            case "unsuspend" -> {
                // T4 only from SUSPENDED: a late unsuspend must not revive a removed installation.
                boolean changed = installationWriter.transition(installation.getId(), EnumSet.of(GitInstallationStatus.SUSPENDED),
                        GitInstallationStatus.CONNECTED, GitInstallationReason.UNSUSPENDED);
                yield changed ? GitWebhookHandlerResult.processed()
                        : GitWebhookHandlerResult.ignored("Installation is " + installation.getStatus());
            }
            case "new_permissions_accepted" -> {
                installationWriter.touchVerified(installation.getId());
                yield GitWebhookHandlerResult.processed();
            }
            case "created" -> GitWebhookHandlerResult.ignored("Installations are registered through Connect GitHub");
            default -> GitWebhookHandlerResult.ignored("Unsupported action: " + action);
        };
    }

    private void forget(GitInstallation installation) {
        tokens.invalidate(installation.getInstallationId());
        cache.evict(installation.getInstallationId());
    }
}
