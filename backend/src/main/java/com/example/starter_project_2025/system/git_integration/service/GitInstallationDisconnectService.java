package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppCredentials;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.dto.DisconnectInstallationRequest;
import com.example.starter_project_2025.system.git_integration.dto.GitInstallationDisconnectResponse;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.Locale;

/**
 * GI-07: disconnect a GitHub account or organization from the platform.
 * <ol>
 *   <li>BR1 / AC02: only a Git Integration manager ("Workspace Admin") or the person who installed
 *       it; anyone else gets 403 and nothing changes.</li>
 *   <li>BR3 / AC03: the account name typed must match (trimmed, case-insensitive like GitHub logins);
 *       otherwise 422 before GitHub is called.</li>
 *   <li>The App is uninstalled on GitHub first, outside any transaction: when GitHub fails nothing
 *       changes and the user tries again. 404 = the owner already removed it (AC04, no error).</li>
 *   <li>Then the installation and every repository still receiving data through it become
 *       DISCONNECTED in one transaction; waiting jobs stop ({@link GitInstallationDisconnectWriter}).
 *       PMs are told after commit (GitConnectionNotifier). Synchronized data is kept (BR5).</li>
 * </ol>
 * Idempotent: an installation already DISCONNECTED is returned as is, without calling GitHub. The
 * "deleted" webhook GitHub sends afterwards finds nothing left to change (BR6).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GitInstallationDisconnectService {

    private final GitHubAppCredentials credentials;
    private final GitIntegrationAccessService access;
    private final GitInstallationRepository installations;
    private final GitInstallationService installationService;
    private final GitInstallationDisconnectWriter writer;
    private final GitHubApiClient github;
    private final InstallationTokenProvider tokens;
    private final InstallationRepositoryCache repositoryCache;

    public GitInstallationDisconnectResponse disconnect(Long installationRowId, DisconnectInstallationRequest request) {
        User user = access.requireUser();
        GitInstallation row = installations.findById(installationRowId)
                .filter(installation -> installation.getTenantId().equals(user.getTenant().getId()))
                .filter(installation -> Boolean.TRUE.equals(installation.getIsActive()))
                .orElseThrow(GitIntegrationException::installationNotFound);
        if (!access.canManage(user) && !user.getId().equals(row.getConnectedByUserId())) {
            throw new AccessDeniedException("Only a Git Integration manager or the person who installed it may disconnect GitHub");
        }
        if (row.getStatus() == GitInstallationStatus.DISCONNECTED) {
            return response(user, row.getId(), 0, true); // AC04: already removed, no error
        }
        if (!matches(request.confirmLogin(), row.getAccountLogin())) {
            throw GitIntegrationException.disconnectConfirmationMismatch();
        }
        if (!credentials.isEnabled()) {
            throw GitIntegrationException.disabled();
        }

        GitHubApiClient.DeleteOutcome outcome;
        try {
            outcome = github.deleteInstallation(row.getInstallationId());
        } catch (GitHubApiException e) {
            log.warn("GitHub refused to uninstall the App: installationId={}, kind={}, status={}",
                    row.getInstallationId(), e.getKind(), e.getHttpStatus());
            throw e.getKind() == GitHubApiException.Kind.RATE_LIMITED
                    ? GitIntegrationException.rateLimited(e.getRetryAfterSeconds())
                    : GitIntegrationException.providerUnavailable();
        }
        boolean alreadyRemoved = outcome == GitHubApiClient.DeleteOutcome.NOT_FOUND;
        GitInstallationDisconnectWriter.Result result = writer.disconnect(row.getId(), user.getId(),
                alreadyRemoved ? GitInstallationReason.UNINSTALLED : GitInstallationReason.DISCONNECTED_BY_USER);
        tokens.invalidate(row.getInstallationId());
        repositoryCache.evict(row.getInstallationId());
        return response(user, row.getId(), result.repositories(), alreadyRemoved);
    }

    private GitInstallationDisconnectResponse response(User user, Long installationRowId, int repositories, boolean alreadyRemoved) {
        GitInstallation fresh = installations.findById(installationRowId).orElseThrow(GitIntegrationException::installationNotFound);
        return new GitInstallationDisconnectResponse(installationService.view(user, fresh), repositories,
                installationService.linkedProjects(fresh), alreadyRemoved);
    }

    /** GitHub logins are case-insensitive. */
    static boolean matches(String typed, String accountLogin) {
        return typed != null && accountLogin != null
                && typed.trim().toLowerCase(Locale.ROOT).equals(accountLogin.trim().toLowerCase(Locale.ROOT));
    }
}
