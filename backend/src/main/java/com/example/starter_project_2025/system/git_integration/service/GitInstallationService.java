package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppCredentials;
import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitOAuthOutcome;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.dto.GitHubCallbackRequest;
import com.example.starter_project_2025.system.git_integration.dto.GitHubCallbackResponse;
import com.example.starter_project_2025.system.git_integration.dto.GitHubConnectStartResponse;
import com.example.starter_project_2025.system.git_integration.dto.GitInstallationListResponse;
import com.example.starter_project_2025.system.git_integration.dto.GitInstallationResponse;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallation;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubUser;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * GI-01: install the authorized GitHub App on a GitHub account or
 * organization and keep the verified installation for the user's tenant.
 * <p>
 * Network calls to GitHub run outside any database transaction; the only
 * write to {@code git_installations} happens in {@link GitInstallationWriter}
 * after every verification passed. Codes, states and tokens are never logged or returned.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GitInstallationService {

    private static final String SETUP_ACTION_REQUEST = "request";
    private static final String ERROR_ACCESS_DENIED = "access_denied";

    private final GitIntegrationAccessService access;
    private final GitHubOAuthStateService stateService;
    private final GitInstallationWriter writer;
    private final GitHubApiClient github;
    private final GitHubAppCredentials credentials;
    private final GitHubAppProperties properties;
    private final GitInstallationRepository installations;
    private final UserRepository users;

    /** Authorize, then hand back the GitHub install URL carrying a fresh state. */
    public GitHubConnectStartResponse startConnect() {
        User user = access.requireUser();
        access.requireManage(user);
        requireEnabled();

        Long tenantId = user.getTenant().getId();
        GitHubOAuthStateService.IssuedState state = stateService.issue(user.getId(), tenantId);
        String installUrl = UriComponentsBuilder.fromHttpUrl(properties.installUrl())
                .queryParam("state", state.rawState())
                .build()
                .toUriString();
        log.info("GitHub connect started: tenantId={}, userId={}", tenantId, user.getId());
        return new GitHubConnectStartResponse(installUrl, state.expiresAt());
    }

    /** Verify what GitHub sent back and store (or refresh) the installation. */
    public GitHubCallbackResponse handleCallback(GitHubCallbackRequest request) {
        User user = access.requireUser();
        requireEnabled();
        Long tenantId = user.getTenant().getId();

        GitHubOAuthStateService.ConsumedState state = stateService.consume(request.state(), user.getId(), tenantId);

        // Re-check: permission may have been revoked while the user was on GitHub (AC03).
        access.requireManage(user);

        if (StringUtils.hasText(request.error())) {
            stateService.recordOutcome(state.id(), GitOAuthOutcome.DENIED);
            boolean denied = ERROR_ACCESS_DENIED.equals(request.error());
            log.info("GitHub connect denied: tenantId={}, userId={}, error={}", tenantId, user.getId(), denied ? request.error() : "other");
            throw denied ? GitIntegrationException.denied() : GitIntegrationException.callbackInvalid();
        }

        if (SETUP_ACTION_REQUEST.equals(request.setupAction()) && request.installationId() == null) {
            stateService.recordOutcome(state.id(), GitOAuthOutcome.PENDING_APPROVAL);
            log.info("GitHub install requested, waiting for owner approval: tenantId={}, userId={}", tenantId, user.getId());
            return new GitHubCallbackResponse(GitOAuthOutcome.PENDING_APPROVAL,
                    "Yêu cầu cài đặt đã được gửi tới chủ sở hữu tổ chức GitHub. Kết nối sẽ hoàn tất sau khi được phê duyệt",
                    null);
        }

        if (!StringUtils.hasText(request.code()) || request.installationId() == null || request.installationId() <= 0) {
            stateService.recordOutcome(state.id(), GitOAuthOutcome.INVALID_CALLBACK);
            throw GitIntegrationException.callbackInvalid();
        }

        long installationId = request.installationId();
        GitHubUser githubUser;
        GitHubInstallation verified;
        try {
            String userToken = github.exchangeCodeForUserToken(request.code());
            githubUser = github.getAuthenticatedUser(userToken);
            if (!github.userCanAccessInstallation(userToken, installationId)) {
                stateService.recordOutcome(state.id(), GitOAuthOutcome.INSTALLATION_NOT_OWNED);
                log.warn("GitHub installation not visible to authorizing user: tenantId={}, userId={}, installationId={}",
                        tenantId, user.getId(), installationId);
                throw GitIntegrationException.installationNotOwned();
            }
            verified = github.getInstallation(installationId)
                    .filter(found -> found.account() != null && found.account().id() != null)
                    .orElse(null);
            if (verified == null) {
                stateService.recordOutcome(state.id(), GitOAuthOutcome.INSTALLATION_NOT_OWNED);
                throw GitIntegrationException.installationNotOwned();
            }
        } catch (GitHubApiException e) {
            boolean unavailable = e.getKind() == GitHubApiException.Kind.UNAVAILABLE;
            stateService.recordOutcome(state.id(), unavailable ? GitOAuthOutcome.PROVIDER_ERROR : GitOAuthOutcome.INVALID_CALLBACK);
            log.warn("GitHub verification failed: tenantId={}, userId={}, installationId={}, reason={}",
                    tenantId, user.getId(), installationId, e.getMessage());
            throw unavailable ? GitIntegrationException.providerUnavailable() : GitIntegrationException.callbackInvalid();
        }

        GitInstallationWriter.UpsertResult result;
        try {
            result = upsertWithRetry(tenantId, user, verified, githubUser);
        } catch (GitIntegrationException e) {
            stateService.recordOutcome(state.id(), GitOAuthOutcome.LINKED_ELSEWHERE);
            throw e;
        }
        stateService.recordOutcome(state.id(), result.outcome());

        String message = result.outcome() == GitOAuthOutcome.RECONNECTED
                ? "Đã cập nhật kết nối GitHub"
                : "Kết nối GitHub thành công";
        return new GitHubCallbackResponse(result.outcome(), message,
                toResponse(result.installation(), Map.of(user.getId(), user)));
    }

    @Transactional(readOnly = true)
    public GitInstallationListResponse listInstallations() {
        User user = access.requireUser();
        access.requireRead(user);
        List<GitInstallation> rows = installations
                .findByTenantIdAndProviderAndIsActiveTrueOrderByConnectedAtDesc(user.getTenant().getId(), GitProvider.GITHUB);

        Map<Long, User> connectedBy = users.findAllById(rows.stream()
                        .map(GitInstallation::getConnectedByUserId).filter(Objects::nonNull).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));

        return new GitInstallationListResponse(summarize(rows), access.canManage(user),
                rows.stream().map(row -> toResponse(row, connectedBy)).toList());
    }

    private static String summarize(List<GitInstallation> rows) {
        if (rows.stream().anyMatch(row -> row.getStatus() == GitInstallationStatus.CONNECTED)) {
            return "CONNECTED";
        }
        if (rows.stream().anyMatch(row -> row.getStatus() == GitInstallationStatus.SUSPENDED)) {
            return "SUSPENDED";
        }
        return "NOT_CONNECTED";
    }

    /** Two callbacks for the same new installation can race on the unique key: retry once as an update. */
    private GitInstallationWriter.UpsertResult upsertWithRetry(Long tenantId, User user,
                                                               GitHubInstallation verified, GitHubUser githubUser) {
        try {
            return writer.upsertVerified(tenantId, user.getId(), verified, githubUser);
        } catch (DataIntegrityViolationException race) {
            return writer.upsertVerified(tenantId, user.getId(), verified, githubUser);
        }
    }

    private void requireEnabled() {
        if (!credentials.isEnabled()) {
            throw GitIntegrationException.disabled();
        }
    }

    private static GitInstallationResponse toResponse(GitInstallation row, Map<Long, User> usersById) {
        User by = usersById.get(row.getConnectedByUserId());
        String name = by == null ? null
                : (by.getFirstName() + (by.getLastName() == null ? "" : " " + by.getLastName())).trim();
        return new GitInstallationResponse(row.getId(), row.getInstallationId(), row.getStatus(),
                row.getAccountLogin(), row.getAccountType(), row.getRepositorySelection(), row.getGithubUserLogin(),
                row.getConnectedByUserId(), name, row.getConnectedAt(), row.getLastVerifiedAt());
    }
}
