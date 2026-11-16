package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitIntegrationOAuthState;
import com.example.starter_project_2025.system.git_integration.domain.GitOAuthOutcome;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.repository.GitIntegrationOAuthStateRepository;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Issues and consumes the one-time {@code state} that ties a GitHub callback
 * to the user and project that started the flow. Each method commits in its
 * own transaction so a consumed state stays consumed even if a later step fails.
 */
@Service
public class GitHubOAuthStateService {

    private static final int STATE_BYTES = 32;
    private static final int MAX_STATE_LENGTH = 128;

    private final GitIntegrationOAuthStateRepository states;
    private final GitHubAppProperties properties;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public GitHubOAuthStateService(GitIntegrationOAuthStateRepository states,
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

    public record ConsumedState(Long id, Long userId, Long projectId) {
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public IssuedState issue(Long userId, Long projectId) {
        byte[] bytes = new byte[STATE_BYTES];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        LocalDateTime expiresAt = LocalDateTime.now(clock).plusSeconds(properties.getStateTtlSeconds());
        states.save(GitIntegrationOAuthState.builder()
                .stateHash(hash(raw))
                .userId(userId)
                .projectId(projectId)
                .provider(GitProvider.GITHUB)
                .expiresAt(expiresAt)
                .build());
        return new IssuedState(raw, expiresAt);
    }

    /**
     * Marks the state as used. Rejects unknown, expired, already used, or
     * other users' states with the same error so nothing leaks to the caller.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = GitIntegrationException.class)
    public ConsumedState consume(String rawState, Long userId) {
        if (!StringUtils.hasText(rawState) || rawState.length() > MAX_STATE_LENGTH) {
            throw GitIntegrationException.stateInvalid();
        }
        GitIntegrationOAuthState state = states.findByStateHashForUpdate(hash(rawState))
                .orElseThrow(GitIntegrationException::stateInvalid);
        LocalDateTime now = LocalDateTime.now(clock);
        // A foreign user must not be able to burn someone else's state, so check ownership first.
        if (!state.getUserId().equals(userId) || state.getConsumedAt() != null || !state.getExpiresAt().isAfter(now)) {
            throw GitIntegrationException.stateInvalid();
        }
        state.setConsumedAt(now);
        return new ConsumedState(state.getId(), state.getUserId(), state.getProjectId());
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
