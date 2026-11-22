package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * GI-04: turns a GitHub failure met while serving a user request into the
 * module's error. GI-02: whether the installation is broken is decided by
 * {@link InstallationHealth}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GitHubFailures {

    private final InstallationHealth health;

    public GitIntegrationException toBusinessError(GitInstallation installation, GitHubApiException e, String operation) {
        return toBusinessError(installation.getId(), installation.getInstallationId(), e, operation);
    }

    public GitIntegrationException toBusinessError(Long installationRowId, long installationId,
                                                   GitHubApiException e, String operation) {
        if (e.getKind() == GitHubApiException.Kind.RATE_LIMITED) {
            return GitIntegrationException.rateLimited(e.getRetryAfterSeconds());
        }
        // GI-02: token 404 → ERROR (not yet DISCONNECTED), suspended → SUSPENDED, a repeated 401 → ERROR.
        GitInstallationStatus broken = health.failed(installationRowId, installationId, e);
        if (broken != null && broken != GitInstallationStatus.CONNECTED) {
            return GitIntegrationException.installationBroken(broken.name());
        }
        log.warn("GitHub call failed: operation={}, installationId={}, reason={}", operation, installationId, e.getMessage());
        return GitIntegrationException.providerUnavailable();
    }

}
