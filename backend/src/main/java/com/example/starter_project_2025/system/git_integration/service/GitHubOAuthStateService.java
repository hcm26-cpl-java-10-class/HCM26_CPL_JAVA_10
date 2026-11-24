package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitOAuthOutcome;
import com.example.starter_project_2025.system.git_integration.domain.GitOAuthPurpose;
import com.example.starter_project_2025.system.git_integration.domain.GitOAuthState;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.repository.GitOAuthStateRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.rbac.user.User;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Issues and consumes the one-time {@code state} that ties a GitHub callback
 * to the user and tenant that started the flow. Each method commits in its
 * own transaction so a consumed state stays consumed even if a later step fails.
 */
@Service
public class GitHubOAuthStateService {
    @Autowired
    private GitEntityReferences entityReferences;

    private static final int STATE_BYTES = 32;
    private static final int MAX_STATE_LENGTH = 128;

    private final GitOAuthStateRepository states;
    private final GitHubAppProperties properties;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public GitHubOAuthStateService(GitOAuthStateRepository states,
                                   GitHubAppProperties properties,
                                   @Qualifier("gitIntegrationClock") Clock clock) {
        this.states = states;
        this.properties = properties;
        this.clock = clock;
    }

    public record IssuedState(String rawState, LocalDateTime expiresAt) {
        @Override
        public String toString() {
            return "IssuedState[expiresAt=" + expiresAt + "]";
        }
    }

    public record ConsumedState(Long id, Long userId, Long tenantId, Long projectId) {
    }

    /** GI-01: a state for installing the GitHub App. (Annotated too: the call below bypasses the proxy.) */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public IssuedState issue(Long userId, Long tenantId) {
        return issue(userId, tenantId, GitOAuthPurpose.INSTALL, null);
    }

    /** A state for {@code purpose}; {@code projectId} is the master project of an account link. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public IssuedState issue(Long userId, Long tenantId, GitOAuthPurpose purpose, Long projectId) {
        byte[] bytes = new byte[STATE_BYTES];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        LocalDateTime expiresAt = LocalDateTime.now(clock).plusSeconds(properties.getStateTtlSeconds());
        states.save(GitOAuthState.builder()
                .stateHash(hash(raw))
                .user(entityReferences.get(User.class, userId))
                .tenant(entityReferences.get(Tenant.class, tenantId))
                .provider(GitProvider.GITHUB)
                .expiresAt(expiresAt)
                .purpose(purpose)
                .project(entityReferences.get(Project.class, projectId))
                .build());
        return new IssuedState(raw, expiresAt);
    }

    /** GI-01: consumes a state issued for installing the GitHub App. (Annotated too: the call below bypasses the proxy.) */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = GitIntegrationException.class)
    public ConsumedState consume(String rawState, Long userId, Long tenantId) {
        return consume(rawState, userId, tenantId, GitOAuthPurpose.INSTALL);
    }

    /**
     * Marks the state as used. Unknown, expired, already used, foreign-user,
     * foreign-tenant and other-purpose states all get the same error so nothing leaks.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = GitIntegrationException.class)
    public ConsumedState consume(String rawState, Long userId, Long tenantId, GitOAuthPurpose expectedPurpose) {
        if (!StringUtils.hasText(rawState) || rawState.length() > MAX_STATE_LENGTH) {
            throw GitIntegrationException.stateInvalid();
        }
        GitOAuthState state = states.findByStateHashForUpdate(hash(rawState))
                .orElseThrow(GitIntegrationException::stateInvalid);
        LocalDateTime now = LocalDateTime.now(clock);
        // A foreign user must not be able to burn someone else's state, so check ownership first.
        if (!state.getUserId().equals(userId) || !state.getTenantId().equals(tenantId)
                || state.getConsumedAt() != null || !state.getExpiresAt().isAfter(now)
                || state.effectivePurpose() != expectedPurpose) {
            throw GitIntegrationException.stateInvalid();
        }
        state.setConsumedAt(now);
        return new ConsumedState(state.getId(), state.getUserId(), state.getTenantId(), state.getProjectId());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordOutcome(Long stateId, GitOAuthOutcome outcome) {
        states.findById(stateId).ifPresent(state -> state.setOutcome(outcome));
    }

    @Transactional
    public int deleteExpired(LocalDateTime cutoff) {
        return states.deleteExpiredBefore(cutoff);
    }

    static String hash(String raw) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.US_ASCII));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}
