package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.GitConnectionStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitIntegrationConnection;
import com.example.starter_project_2025.system.git_integration.domain.GitOAuthOutcome;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallation;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubUser;
import com.example.starter_project_2025.system.git_integration.repository.GitIntegrationConnectionRepository;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;

/**
 * The only place that writes {@code git_integration_connections}. Runs after
 * every GitHub check has passed, in a short transaction of its own.
 */
@Service
public class GitHubConnectionWriter {

    private final GitIntegrationConnectionRepository connections;
    private final Clock clock;

    public GitHubConnectionWriter(GitIntegrationConnectionRepository connections,
                                  @Qualifier("gitIntegrationClock") Clock clock) {
        this.connections = connections;
        this.clock = clock;
    }

    public record UpsertResult(GitIntegrationConnection connection, GitOAuthOutcome outcome) {
    }

    /** Inserts a new connection (AC01) or refreshes the existing one for the same installation (AC05). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public UpsertResult upsert(Long tenantId, Long projectId, Long userId,
                               GitHubInstallation installation, GitHubUser githubUser) {
        LocalDateTime now = LocalDateTime.now(clock);
        var existing = connections.findByProviderAndInstallationId(GitProvider.GITHUB, installation.id());
        if (existing.isPresent() && !existing.get().getProjectId().equals(projectId)) {
            throw GitIntegrationException.linkedElsewhere();
        }

        GitIntegrationConnection connection = existing.orElseGet(() -> GitIntegrationConnection.builder()
                .tenantId(tenantId)
                .projectId(projectId)
                .provider(GitProvider.GITHUB)
                .installationId(installation.id())
                .build());
        GitOAuthOutcome outcome = existing.isPresent() ? GitOAuthOutcome.RECONNECTED : GitOAuthOutcome.CONNECTED;

        connection.setAccountId(installation.account().id());
        connection.setAccountLogin(installation.account().login());
        connection.setAccountType(installation.account().type());
        connection.setRepositorySelection(installation.repositorySelection());
        connection.setStatus(installation.suspended() ? GitConnectionStatus.SUSPENDED : GitConnectionStatus.CONNECTED);
        connection.setIsActive(true);
        connection.setConnectedByUserId(userId);
        connection.setGithubUserId(githubUser.id());
        connection.setGithubUserLogin(githubUser.login());
        connection.setConnectedAt(now);
        connection.setLastVerifiedAt(now);

        return new UpsertResult(connections.saveAndFlush(connection), outcome);
    }
}
