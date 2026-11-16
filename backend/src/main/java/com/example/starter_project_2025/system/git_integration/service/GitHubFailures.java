package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * GI-04: turns a GitHub failure met while serving a user request into the
 * module's error, updating the installation when GitHub reports it gone or
 * suspended (T6 / T5, same as GI-03).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GitHubFailures {

    private final GitInstallationWriter installationWriter;
    private final InstallationTokenProvider tokens;
    private final InstallationRepositoryCache cache;

    public GitIntegrationException toBusinessError(GitInstallation installation, GitHubApiException e, String operation) {
        return toBusinessError(installation.getId(), installation.getInstallationId(), e, operation);
    }

    public GitIntegrationException toBusinessError(Long installationRowId, long installationId,
                                                   GitHubApiException e, String operation) {
        switch (e.getKind()) {
            case GONE -> {
                forget(installationId);
                installationWriter.markStatus(installationRowId, GitInstallationStatus.DISCONNECTED, operation + "-token-404");
                return GitIntegrationException.installationNotActive(GitInstallationStatus.DISCONNECTED.name());
            }
            case SUSPENDED -> {
                forget(installationId);
                installationWriter.markStatus(installationRowId, GitInstallationStatus.SUSPENDED, operation + "-token-suspended");
                return GitIntegrationException.installationNotActive(GitInstallationStatus.SUSPENDED.name());
            }
            case RATE_LIMITED -> {
                return GitIntegrationException.rateLimited(e.getRetryAfterSeconds());
            }
            default -> {
                if (e.getHttpStatus() == 401) {
                    tokens.invalidate(installationId); // a revoked token: the next call asks for a new one
                }
                log.warn("GitHub call failed: operation={}, installationId={}, reason={}", operation, installationId, e.getMessage());
                return GitIntegrationException.providerUnavailable();
            }
        }
    }

    private void forget(long installationId) {
        tokens.invalidate(installationId);
        cache.evict(installationId);
    }
}
