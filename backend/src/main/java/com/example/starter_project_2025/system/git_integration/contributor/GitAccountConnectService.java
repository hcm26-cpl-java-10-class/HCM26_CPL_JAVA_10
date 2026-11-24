package com.example.starter_project_2025.system.git_integration.contributor;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppCredentials;
import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.contributor.GitAccountMappingWriter.Mapped;
import com.example.starter_project_2025.system.git_integration.contributor.GitAccountMappingWriter.VerifiedAccount;
import com.example.starter_project_2025.system.git_integration.domain.GitContributorMapSource;
import com.example.starter_project_2025.system.git_integration.domain.GitIdentitySource;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitOAuthOutcome;
import com.example.starter_project_2025.system.git_integration.domain.GitOAuthPurpose;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.UserGitIdentity;
import com.example.starter_project_2025.system.git_integration.dto.GitAccountCallbackRequest;
import com.example.starter_project_2025.system.git_integration.dto.GitAccountConnectResponse;
import com.example.starter_project_2025.system.git_integration.dto.GitAccountConnectResponse.GitAccountView;
import com.example.starter_project_2025.system.git_integration.dto.GitAccountConnectResponse.Outcome;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubUser;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.UserGitIdentityRepository;
import com.example.starter_project_2025.system.git_integration.service.GitHubOAuthStateService;
import com.example.starter_project_2025.system.git_integration.service.GitIntegrationAccessService;
import com.example.starter_project_2025.system.rbac.user.User;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * GI-06: "Connect GitHub account" of the signed-in member. A GitHub account the user already
 * proved is reused without leaving the app (AC01); otherwise the user authorizes the GitHub App
 * with their own account (AC02, BR4) and the callback maps the account returned by GET /user.
 * The mapping is stored at the master project, also when started from a module (AC07).
 * <p>
 * GitHub is called outside any transaction; codes, states and tokens are never logged or
 * returned, and the user token is dropped once the identity is read.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GitAccountConnectService {

    private static final String ERROR_ACCESS_DENIED = "access_denied";
    private static final String CONNECTED_MESSAGE = "Đã kết nối tài khoản GitHub";

    private static final Map<String, GitOAuthOutcome> OUTCOME_BY_CODE = Map.of(
            "GIT_IDENTITY_LINKED_ELSEWHERE", GitOAuthOutcome.IDENTITY_LINKED_ELSEWHERE,
            "GIT_IDENTITY_MISMATCH", GitOAuthOutcome.IDENTITY_MISMATCH,
            "GIT_ACCOUNT_MAPPED_TO_OTHER_MEMBER", GitOAuthOutcome.MAPPED_TO_OTHER_MEMBER,
            "GIT_NOT_PROJECT_MEMBER", GitOAuthOutcome.NOT_PROJECT_MEMBER);

    private final GitIntegrationAccessService access;
    private final GitAccountContextLoader contexts;
    private final GitAccountMappingWriter writer;
    private final GitHubOAuthStateService states;
    private final GitHubApiClient github;
    private final GitHubAppCredentials credentials;
    private final GitHubAppProperties properties;
    private final UserGitIdentityRepository identities;
    private final GitInstallationRepository installations;

    public GitAccountConnectResponse connect(Long projectId) {
        User user = access.requireUser();
        requireEnabled();
        MasterContext context = contexts.load(user, projectId);
        if (!context.isMember(user.getId())) throw GitIntegrationException.notProjectMember(); // AC06

        Optional<UserGitIdentity> identity = identities.findByUser_IdAndProvider(user.getId(), GitProvider.GITHUB);
        if (identity.isPresent()) {
            UserGitIdentity known = identity.get();
            Mapped mapped = mapWithRetry(context, user, new VerifiedAccount(known.getExternalUserId(), known.getLogin(),
                    known.getAvatarUrl(), known.getSource(), false), GitContributorMapSource.IDENTITY);
            log.info("GitHub account mapped from a verified identity: tenantId={}, userId={}, masterId={}",
                    context.tenantId(), user.getId(), context.masterId());
            return connected(context, mapped);
        }

        Optional<GitInstallation> installed = installations
                .findFirstByConnectedByUser_IdAndTenant_IdAndProviderAndGithubUserIdIsNotNullOrderByConnectedAtDesc(
                        user.getId(), context.tenantId(), GitProvider.GITHUB);
        if (installed.isPresent()) {
            GitInstallation row = installed.get();
            try {
                Mapped mapped = mapWithRetry(context, user, new VerifiedAccount(row.getGithubUserId(), row.getGithubUserLogin(),
                        null, GitIdentitySource.INSTALLATION, false), GitContributorMapSource.IDENTITY);
                log.info("GitHub account mapped from the user's App installation: tenantId={}, userId={}, masterId={}",
                        context.tenantId(), user.getId(), context.masterId());
                return connected(context, mapped);
            } catch (GitIntegrationException taken) {
                if (!"GIT_IDENTITY_LINKED_ELSEWHERE".equals(taken.getCode())) throw taken;
                // The installer's account belongs to someone else: let the user prove their own account.
            }
        }

        GitHubOAuthStateService.IssuedState state = states.issue(user.getId(), context.tenantId(),
                GitOAuthPurpose.ACCOUNT_LINK, context.masterId());
        log.info("GitHub account authorization started: tenantId={}, userId={}, masterId={}",
                context.tenantId(), user.getId(), context.masterId());
        return new GitAccountConnectResponse(Outcome.AUTHORIZE_REQUIRED, properties.authorizeUrl(state.rawState()),
                state.expiresAt(), null, context.summary(), null);
    }

    public GitAccountConnectResponse callback(GitAccountCallbackRequest request) {
        User user = access.requireUser();
        requireEnabled();
        Long tenantId = user.getTenant().getId();
        GitHubOAuthStateService.ConsumedState state = states.consume(request.state(), user.getId(), tenantId,
                GitOAuthPurpose.ACCOUNT_LINK); // AC03: invalid, expired, reused or foreign state

        if (StringUtils.hasText(request.error())) {
            states.recordOutcome(state.id(), GitOAuthOutcome.DENIED);
            boolean denied = ERROR_ACCESS_DENIED.equals(request.error());
            log.info("GitHub account authorization not granted: tenantId={}, userId={}, error={}",
                    tenantId, user.getId(), denied ? request.error() : "other");
            throw denied ? GitIntegrationException.denied() : GitIntegrationException.callbackInvalid();
        }
        if (!StringUtils.hasText(request.code()) || state.projectId() == null) {
            states.recordOutcome(state.id(), GitOAuthOutcome.INVALID_CALLBACK);
            throw GitIntegrationException.callbackInvalid();
        }

        GitHubUser account;
        try {
            String userToken = github.exchangeCodeForUserToken(request.code());
            account = github.getAuthenticatedUser(userToken); // ownership: GET /user, never /users/{username}
        } catch (GitHubApiException e) {
            boolean unavailable = e.isTransient();
            states.recordOutcome(state.id(), unavailable ? GitOAuthOutcome.PROVIDER_ERROR : GitOAuthOutcome.INVALID_CALLBACK);
            log.warn("GitHub account verification failed: tenantId={}, userId={}, reason={}", tenantId, user.getId(), e.getMessage());
            throw unavailable ? GitIntegrationException.providerUnavailable() : GitIntegrationException.callbackInvalid();
        }
        if (account == null || account.id() == null) {
            states.recordOutcome(state.id(), GitOAuthOutcome.INVALID_CALLBACK);
            throw GitIntegrationException.callbackInvalid();
        }

        try {
            // Re-checked: the user may have left the project while on GitHub.
            MasterContext context = contexts.load(user, state.projectId());
            if (!context.isMember(user.getId())) throw GitIntegrationException.notProjectMember();
            Mapped mapped = mapWithRetry(context, user, new VerifiedAccount(account.id(), account.login(), account.avatarUrl(),
                    GitIdentitySource.OAUTH, true), GitContributorMapSource.OAUTH);
            states.recordOutcome(state.id(), GitOAuthOutcome.ACCOUNT_LINKED);
            log.info("GitHub account connected: tenantId={}, userId={}, masterId={}", tenantId, user.getId(), context.masterId());
            return connected(context, mapped);
        } catch (GitIntegrationException rejected) {
            states.recordOutcome(state.id(), OUTCOME_BY_CODE.getOrDefault(rejected.getCode(), GitOAuthOutcome.INVALID_CALLBACK));
            log.info("GitHub account not connected: tenantId={}, userId={}, code={}", tenantId, user.getId(), rejected.getCode());
            throw rejected;
        }
    }

    /** Two requests for the same new identity or contributor can race on a unique key: run once more. */
    private Mapped mapWithRetry(MasterContext context, User user, VerifiedAccount account, GitContributorMapSource source) {
        try {
            return writer.linkAndMap(context.tenantId(), context.masterId(), user.getId(), account, source);
        } catch (DataIntegrityViolationException race) {
            return writer.linkAndMap(context.tenantId(), context.masterId(), user.getId(), account, source);
        }
    }

    private static GitAccountConnectResponse connected(MasterContext context, Mapped mapped) {
        GitAccountView view = new GitAccountView(mapped.identity().getExternalUserId(), mapped.identity().getLogin(),
                mapped.identity().getAvatarUrl());
        return new GitAccountConnectResponse(Outcome.CONNECTED, null, null, view, context.summary(), CONNECTED_MESSAGE);
    }

    private void requireEnabled() {
        if (!credentials.isEnabled()) throw GitIntegrationException.disabled();
    }
}
