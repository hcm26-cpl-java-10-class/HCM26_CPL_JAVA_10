package com.example.starter_project_2025.system.git_integration.webhook.handler;

import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookContext;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookHandlerResult;

import java.util.Optional;

/**
 * SY-04 AC03: activity events are only synchronized for a repository linked ACTIVE
 * to a project, reached through the installation that sent the event. Otherwise
 * the event is IGNORED and nothing reaches the Analytics data.
 */
final class LinkedRepositoryGuard {

    private LinkedRepositoryGuard() {
    }

    /** The IGNORED result when the event must not be synchronized; empty when it may. */
    static Optional<GitWebhookHandlerResult> check(GitWebhookContext context) {
        if (context.repository() == null) {
            return Optional.of(GitWebhookHandlerResult.ignored("Repository is not linked to a project or is not active"));
        }
        if (context.installation() != null && !context.installation().getId().equals(context.repository().getInstallationRef())) {
            return Optional.of(GitWebhookHandlerResult.ignored("The sending installation does not own the active repository connection"));
        }
        return Optional.empty();
    }
}
