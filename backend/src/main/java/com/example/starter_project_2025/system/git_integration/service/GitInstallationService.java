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
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Comparator;
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
    private final GitRepositoryRepository connections;
    private final ProjectRepository projects;

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
            boolean unavailable = e.isTransient();
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
        return new GitHubCallbackResponse(result.outcome(), message, view(user, result.installation()));
    }

    @Transactional(readOnly = true)
    public GitInstallationListResponse listInstallations() {
        User user = access.requireUser();
        access.requireRead(user);
        List<GitInstallation> rows = latestPerAccount(installations
                .findByTenantIdAndProviderAndIsActiveTrueOrderByConnectedAtDesc(user.getTenant().getId(), GitProvider.GITHUB));

        Map<Long, User> people = people(rows);
        Map<Long, List<GitInstallationResponse.LinkedProject>> linked = linkedProjects(rows.stream().map(GitInstallation::getId).toList());
        return new GitInstallationListResponse(summarize(rows), access.canManage(user),
                rows.stream().map(row -> toResponse(row, people, linked.getOrDefault(row.getId(), List.of()),
                        canDisconnect(user, row))).toList());
    }

    /**
     * Reconnecting an account after a disconnection creates a new GitHub installation (new {@code installation_id}),
     * so the old, DISCONNECTED row stays in the table. Show one card per GitHub account: its most recent installation
     * ({@code rows} are ordered by {@code connectedAt} desc). A DISCONNECTED row is still listed while it is the
     * account's latest one, so the account can be reconnected from the page.
     */
    private static List<GitInstallation> latestPerAccount(List<GitInstallation> rows) {
        Map<Object, GitInstallation> latest = new java.util.LinkedHashMap<>();
        for (GitInstallation row : rows) {
            Object account = row.getAccountId() != null ? row.getAccountId() : "installation:" + row.getId();
            latest.putIfAbsent(account, row);
        }
        return List.copyOf(latest.values());
    }

    private static String summarize(List<GitInstallation> rows) {
        if (rows.stream().anyMatch(row -> row.getStatus() == GitInstallationStatus.CONNECTED)) {
            return "CONNECTED";
        }
        if (rows.stream().anyMatch(row -> row.getStatus() == GitInstallationStatus.ERROR)) {
            return "ERROR";
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

    /**
     * GI-07 BR1: a Git Integration manager ("Workspace Admin") or the person who installed it may
     * disconnect an installation that is not disconnected yet.
     */
    public boolean canDisconnect(User user, GitInstallation row) {
        return row.getStatus() != GitInstallationStatus.DISCONNECTED
                && (access.canManage(user) || user.getId().equals(row.getConnectedByUserId()));
    }

    /** One installation as {@code viewer} sees it. */
    @Transactional(readOnly = true)
    public GitInstallationResponse view(User viewer, GitInstallation row) {
        return toResponse(row, people(List.of(row)), linkedProjects(row), canDisconnect(viewer, row));
    }

    /** Who connected and who disconnected the installations. */
    private Map<Long, User> people(List<GitInstallation> rows) {
        List<Long> ids = rows.stream()
                .flatMap(row -> java.util.stream.Stream.of(row.getConnectedByUserId(), row.getDisconnectedByUserId()))
                .filter(Objects::nonNull).distinct().toList();
        return ids.isEmpty() ? Map.of()
                : users.findAllById(ids).stream().collect(Collectors.toMap(User::getId, Function.identity()));
    }

    public List<GitInstallationResponse.LinkedProject> linkedProjects(GitInstallation row) {
        return linkedProjects(List.of(row.getId())).getOrDefault(row.getId(), List.of());
    }

    /** Master projects whose current repository (ACTIVE, ERROR or DISCONNECTED) is read through each installation. */
    private Map<Long, List<GitInstallationResponse.LinkedProject>> linkedProjects(List<Long> installationRowIds) {
        if (installationRowIds.isEmpty()) return Map.of();
        List<GitRepository> repositories = connections.findByInstallationRefInAndStatusIn(installationRowIds, GitRepositoryRepository.CURRENT);
        Map<Long, Project> byId = projects.findAllById(repositories.stream().map(GitRepository::getProjectId).distinct().toList())
                .stream().collect(Collectors.toMap(Project::getId, Function.identity()));
        return repositories.stream()
                .filter(repository -> byId.containsKey(repository.getProjectId()))
                .sorted(Comparator.comparing(GitRepository::getFullName, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.groupingBy(GitRepository::getInstallationRef, Collectors.mapping(repository -> {
                    Project project = byId.get(repository.getProjectId());
                    return new GitInstallationResponse.LinkedProject(project.getId(), project.getCode(), project.getName(),
                            repository.getFullName(), repository.getStatus());
                }, Collectors.toList())));
    }

    private static GitInstallationResponse toResponse(GitInstallation row, Map<Long, User> usersById,
                                                      List<GitInstallationResponse.LinkedProject> linked, boolean canDisconnect) {
        Long disconnectedBy = row.getDisconnectedByUserId();
        return new GitInstallationResponse(row.getId(), row.getInstallationId(), row.getStatus(),
                row.getAccountLogin(), row.getAccountType(), row.getRepositorySelection(), row.getGithubUserLogin(),
                row.getConnectedByUserId(), name(usersById.get(row.getConnectedByUserId())), row.getConnectedAt(), row.getLastVerifiedAt(),
                row.getStatusReason(), row.getStatusChangedAt(), row.getLastCheckedAt(), linked, canDisconnect,
                disconnectedBy == null ? null : new GitInstallationResponse.Person(disconnectedBy, name(usersById.get(disconnectedBy))));
    }

    private static String name(User user) {
        return user == null ? null
                : (user.getFirstName() + (user.getLastName() == null ? "" : " " + user.getLastName())).trim();
    }

    /** GI-02: one installation as listed (after "Check again"). */
    @Transactional(readOnly = true)
    public GitInstallationResponse installation(Long installationRowId) {
        GitInstallation row = installations.findById(installationRowId).orElseThrow(GitIntegrationException::installationNotFound);
        return view(access.requireUser(), row);
    }
}
