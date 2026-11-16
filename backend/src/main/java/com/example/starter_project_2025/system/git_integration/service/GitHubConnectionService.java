package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppCredentials;
import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitConnectionStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitIntegrationConnection;
import com.example.starter_project_2025.system.git_integration.domain.GitOAuthOutcome;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.dto.GitHubCallbackRequest;
import com.example.starter_project_2025.system.git_integration.dto.GitHubCallbackResponse;
import com.example.starter_project_2025.system.git_integration.dto.GitHubConnectStartResponse;
import com.example.starter_project_2025.system.git_integration.dto.GitHubConnectionResponse;
import com.example.starter_project_2025.system.git_integration.dto.GitHubConnectionStatusResponse;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallation;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubUser;
import com.example.starter_project_2025.system.git_integration.repository.GitIntegrationConnectionRepository;
import com.example.starter_project_2025.system.project.domain.Project;
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
 * US-GIT-001: connect a master project to a GitHub App installation.
 * <p>
 * Network calls to GitHub run outside any database transaction; the only
 * write to {@code git_integration_connections} happens in
 * {@link GitHubConnectionWriter} after every verification has passed.
 * Codes, states and tokens are never logged or returned.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GitHubConnectionService {

    private static final String SETUP_ACTION_REQUEST = "request";
    private static final String ERROR_ACCESS_DENIED = "access_denied";

    private final GitIntegrationAccessService access;
    private final GitHubOAuthStateService stateService;
    private final GitHubConnectionWriter writer;
    private final GitHubApiClient github;
    private final GitHubAppCredentials credentials;
    private final GitHubAppProperties properties;
    private final GitIntegrationConnectionRepository connections;
    private final UserRepository users;

    /** Step 1: authorize, then hand back the GitHub install URL carrying a fresh state. */
    public GitHubConnectStartResponse startConnect(Long projectId) {
        User user = access.requireUser();
        Project project = access.requireManage(user, projectId);
        requireEnabled();

        GitHubOAuthStateService.IssuedState state = stateService.issue(user.getId(), project.getId());
        String installUrl = UriComponentsBuilder.fromHttpUrl(properties.installUrl())
                .queryParam("state", state.rawState())
                .build()
                .toUriString();
        log.info("GitHub connect started: projectId={}, userId={}", project.getId(), user.getId());
        return new GitHubConnectStartResponse(installUrl, state.expiresAt());
    }

    /** Step 2: verify what GitHub sent back and store the installation. */
    public GitHubCallbackResponse handleCallback(GitHubCallbackRequest request) {
        User user = access.requireUser();
        requireEnabled();

        GitHubOAuthStateService.ConsumedState state = stateService.consume(request.state(), user.getId());
        Long projectId = state.projectId();

        // Re-check: permission may have been revoked while the user was on GitHub (AC03).
        Project project = access.requireManage(user, projectId);

        if (StringUtils.hasText(request.error())) {
            stateService.recordOutcome(state.id(), GitOAuthOutcome.DENIED);
            log.info("GitHub connect denied by user: projectId={}, userId={}, error={}",
                    projectId, user.getId(), ERROR_ACCESS_DENIED.equals(request.error()) ? request.error() : "other");
            if (ERROR_ACCESS_DENIED.equals(request.error())) {
                throw GitIntegrationException.denied();
            }
            throw GitIntegrationException.callbackInvalid();
        }

        if (SETUP_ACTION_REQUEST.equals(request.setupAction()) && request.installationId() == null) {
            stateService.recordOutcome(state.id(), GitOAuthOutcome.PENDING_APPROVAL);
            log.info("GitHub install requested, waiting for owner approval: projectId={}, userId={}",
                    projectId, user.getId());
            return new GitHubCallbackResponse(GitOAuthOutcome.PENDING_APPROVAL, projectId,
                    "Yêu cầu cài đặt đã được gửi tới chủ sở hữu tổ chức GitHub. Kết nối sẽ hoàn tất sau khi được phê duyệt",
                    null);
        }

        if (!StringUtils.hasText(request.code()) || request.installationId() == null || request.installationId() <= 0) {
            stateService.recordOutcome(state.id(), GitOAuthOutcome.INVALID_CALLBACK);
            throw GitIntegrationException.callbackInvalid();
        }

        long installationId = request.installationId();
        GitHubUser githubUser;
        GitHubInstallation installation;
        try {
            String userToken = github.exchangeCodeForUserToken(request.code());
            githubUser = github.getAuthenticatedUser(userToken);
            if (!github.userCanAccessInstallation(userToken, installationId)) {
                stateService.recordOutcome(state.id(), GitOAuthOutcome.INSTALLATION_NOT_OWNED);
                log.warn("GitHub installation not visible to authorizing user: projectId={}, userId={}, installationId={}",
                        projectId, user.getId(), installationId);
                throw GitIntegrationException.installationNotOwned();
            }
            installation = github.getInstallation(installationId)
                    .filter(found -> found.account() != null && found.account().id() != null)
                    .orElse(null);
            if (installation == null) {
                stateService.recordOutcome(state.id(), GitOAuthOutcome.INSTALLATION_NOT_OWNED);
                throw GitIntegrationException.installationNotOwned();
            }
        } catch (GitHubApiException e) {
            boolean unavailable = e.getKind() == GitHubApiException.Kind.UNAVAILABLE;
            stateService.recordOutcome(state.id(),
                    unavailable ? GitOAuthOutcome.PROVIDER_ERROR : GitOAuthOutcome.INVALID_CALLBACK);
            log.warn("GitHub verification failed: projectId={}, userId={}, installationId={}, reason={}",
                    projectId, user.getId(), installationId, e.getMessage());
            throw unavailable ? GitIntegrationException.providerUnavailable() : GitIntegrationException.callbackInvalid();
        }

        GitHubConnectionWriter.UpsertResult result;
        try {
            result = upsertWithRetry(project, user, installation, githubUser);
        } catch (GitIntegrationException e) {
            stateService.recordOutcome(state.id(), GitOAuthOutcome.LINKED_ELSEWHERE);
            throw e;
        }
        stateService.recordOutcome(state.id(), result.outcome());
        log.info("GitHub installation {}: projectId={}, userId={}, installationId={}, account={}",
                result.outcome(), projectId, user.getId(), installationId, installation.account().login());

        String message = result.outcome() == GitOAuthOutcome.RECONNECTED
                ? "Đã cập nhật kết nối GitHub"
                : "Kết nối GitHub thành công";
        return new GitHubCallbackResponse(result.outcome(), projectId, message,
                toResponse(result.connection(), Map.of(user.getId(), user)));
    }

    @Transactional(readOnly = true)
    public GitHubConnectionStatusResponse getStatus(Long projectId) {
        User user = access.requireUser();
        Project project = access.requireRead(user, projectId);
        List<GitIntegrationConnection> rows = connections
                .findByProjectIdAndProviderAndIsActiveTrueOrderByConnectedAtDesc(project.getId(), GitProvider.GITHUB);

        Map<Long, User> connectedBy = users.findAllById(rows.stream()
                        .map(GitIntegrationConnection::getConnectedByUserId).filter(Objects::nonNull).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));

        String status;
        if (rows.stream().anyMatch(row -> row.getStatus() == GitConnectionStatus.CONNECTED)) {
            status = "CONNECTED";
        } else if (rows.stream().anyMatch(row -> row.getStatus() == GitConnectionStatus.SUSPENDED)) {
            status = "SUSPENDED";
        } else {
            status = "NOT_CONNECTED";
        }
        return new GitHubConnectionStatusResponse(project.getId(), status, access.canManage(user),
                rows.stream().map(row -> toResponse(row, connectedBy)).toList());
    }

    /** Two callbacks for the same new installation can race on the unique key: retry once as an update. */
    private GitHubConnectionWriter.UpsertResult upsertWithRetry(Project project, User user,
                                                                GitHubInstallation installation, GitHubUser githubUser) {
        try {
            return writer.upsert(project.getTenantId(), project.getId(), user.getId(), installation, githubUser);
        } catch (DataIntegrityViolationException race) {
            return writer.upsert(project.getTenantId(), project.getId(), user.getId(), installation, githubUser);
        }
    }

    private void requireEnabled() {
        if (!credentials.isEnabled()) {
            throw GitIntegrationException.disabled();
        }
    }

    private static GitHubConnectionResponse toResponse(GitIntegrationConnection row, Map<Long, User> usersById) {
        User by = usersById.get(row.getConnectedByUserId());
        String name = by == null ? null
                : (by.getFirstName() + (by.getLastName() == null ? "" : " " + by.getLastName())).trim();
        return new GitHubConnectionResponse(row.getId(), row.getProjectId(), row.getInstallationId(), row.getStatus(),
                row.getAccountLogin(), row.getAccountType(), row.getRepositorySelection(), row.getGithubUserLogin(),
                row.getConnectedByUserId(), name, row.getConnectedAt(), row.getLastVerifiedAt());
    }
}
