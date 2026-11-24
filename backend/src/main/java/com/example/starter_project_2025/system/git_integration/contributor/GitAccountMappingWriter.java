package com.example.starter_project_2025.system.git_integration.contributor;

import com.example.starter_project_2025.system.git_integration.domain.GitContributor;
import com.example.starter_project_2025.system.git_integration.domain.GitContributorMapSource;
import com.example.starter_project_2025.system.git_integration.domain.GitIdentitySource;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.UserGitIdentity;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.repository.GitContributorRepository;
import com.example.starter_project_2025.system.git_integration.repository.UserGitIdentityRepository;
import com.example.starter_project_2025.system.git_integration.service.GitEntityReferences;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.rbac.user.User;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * GI-06: the only writes of the account mapping. Each method is one transaction that re-checks
 * the rules on locked rows, so a rejected attempt changes nothing (AC03, AC04, AC05).
 */
@Component
class GitAccountMappingWriter {
    @Autowired
    private GitEntityReferences entityReferences;

    private final UserGitIdentityRepository identities;
    private final GitContributorRepository contributors;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    GitAccountMappingWriter(UserGitIdentityRepository identities, GitContributorRepository contributors,
                            ApplicationEventPublisher events, @Qualifier("gitIntegrationClock") Clock clock) {
        this.identities = identities;
        this.contributors = contributors;
        this.events = events;
        this.clock = clock;
    }

    /** A GitHub account whose ownership is proven (GET /user, or an identity verified earlier). */
    record VerifiedAccount(long githubUserId, String login, String avatarUrl, GitIdentitySource source, boolean freshlyVerified) {
    }

    record Mapped(UserGitIdentity identity, GitContributor contributor) {
    }

    /**
     * Stores (or refreshes) the user's identity, then maps the account's contributor of the
     * master project to the user. Idempotent when already mapped to the same user.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Mapped linkAndMap(Long tenantId, Long masterId, Long userId, VerifiedAccount account, GitContributorMapSource mapSource) {
        LocalDateTime now = LocalDateTime.now(clock);
        UserGitIdentity identity = identity(tenantId, userId, account, now);

        String key = ContributorIdentity.githubKey(account.githubUserId());
        GitContributor contributor = contributors.lockByIdentity(masterId, key)
                .orElseGet(() -> GitContributor.builder()
                        .tenant(entityReferences.get(Tenant.class, tenantId)).masterProject(entityReferences.get(Project.class, masterId)).identityKey(key)
                        .externalUserId(account.githubUserId()).build());
        if (contributor.getUserId() != null && !contributor.getUserId().equals(userId)) {
            throw GitIntegrationException.accountMappedToOtherMember(); // AC05
        }
        if (account.login() != null) contributor.setLogin(account.login()); // AC08
        boolean changed = contributor.getUserId() == null;
        if (changed) contributor.map(entityReferences.get(User.class, userId),
                mapSource, entityReferences.get(User.class, userId), now);
        contributor = contributors.saveAndFlush(contributor);
        if (changed) events.publishEvent(new GitContributorMappingChangedEvent(tenantId, masterId));
        return new Mapped(identity, contributor);
    }

    private UserGitIdentity identity(Long tenantId, Long userId, VerifiedAccount account, LocalDateTime now) {
        UserGitIdentity byAccount = identities.findByProviderAndExternalUserId(GitProvider.GITHUB, account.githubUserId()).orElse(null);
        if (byAccount != null && !byAccount.getUserId().equals(userId)) {
            // AC04: the account still counts for someone else. Once it is unlinked everywhere (AC10),
            // the owner who just proved it on GitHub may take it over; the old user keeps no claim.
            if (!account.freshlyVerified() || contributors.existsByUser_IdAndExternalUserId(byAccount.getUserId(), account.githubUserId())) {
                throw GitIntegrationException.identityLinkedElsewhere();
            }
            requireNoOtherIdentity(userId);
            byAccount.setUser(entityReferences.get(User.class, userId));
            byAccount.setTenant(entityReferences.get(Tenant.class, tenantId));
            byAccount.setSource(account.source());
            byAccount.setVerifiedAt(now);
        } else if (byAccount == null) {
            requireNoOtherIdentity(userId);
            byAccount = UserGitIdentity.builder()
                    .tenant(entityReferences.get(Tenant.class, tenantId)).user(entityReferences.get(User.class, userId)).provider(GitProvider.GITHUB)
                    .externalUserId(account.githubUserId()).source(account.source()).verifiedAt(now)
                    .build();
        } else if (account.freshlyVerified()) {
            byAccount.setVerifiedAt(now);
        }
        if (account.login() != null) byAccount.setLogin(account.login());
        if (account.avatarUrl() != null) byAccount.setAvatarUrl(account.avatarUrl());
        if (byAccount.getLogin() == null) byAccount.setLogin(String.valueOf(account.githubUserId()));
        return identities.saveAndFlush(byAccount);
    }

    /** A user has one GitHub identity: linking a second account is a mismatch. */
    private void requireNoOtherIdentity(Long userId) {
        identities.findByUser_IdAndProvider(userId, GitProvider.GITHUB).ifPresent(other -> {
            throw GitIntegrationException.identityMismatch(other.getLogin());
        });
    }

    /** AC10: the member's GitHub account no longer counts for them; Git data and e-mails stay. */
    @Transactional
    public void unlinkGitHub(Long tenantId, Long masterId, Long userId) {
        List<GitContributor> mapped = contributors.lockGitHubMappings(masterId, userId);
        if (mapped.isEmpty()) throw GitIntegrationException.accountMappingNotFound();
        mapped.forEach(GitContributor::unmap);
        contributors.saveAllAndFlush(mapped);
        events.publishEvent(new GitContributorMappingChangedEvent(tenantId, masterId));
    }

    /** AC11: only this e-mail-only contributor changes; nothing is merged. */
    @Transactional
    public GitContributor assign(Long tenantId, Long masterId, Long contributorId, Long memberId, Long byUserId) {
        GitContributor contributor = emailContributor(masterId, contributorId);
        contributor.map(entityReferences.get(User.class, memberId),
                GitContributorMapSource.MANUAL, entityReferences.get(User.class, byUserId), LocalDateTime.now(clock));
        contributor = contributors.saveAndFlush(contributor);
        events.publishEvent(new GitContributorMappingChangedEvent(tenantId, masterId));
        return contributor;
    }

    @Transactional
    public GitContributor unassign(Long tenantId, Long masterId, Long contributorId) {
        GitContributor contributor = emailContributor(masterId, contributorId);
        if (contributor.getUserId() == null) return contributor;
        contributor.unmap();
        contributor = contributors.saveAndFlush(contributor);
        events.publishEvent(new GitContributorMappingChangedEvent(tenantId, masterId));
        return contributor;
    }

    private GitContributor emailContributor(Long masterId, Long contributorId) {
        GitContributor contributor = contributors.lockById(contributorId, masterId)
                .orElseThrow(GitIntegrationException::contributorNotFound);
        if (contributor.isGitHub()) throw GitIntegrationException.contributorHasGitHubId(); // BR4
        return contributor;
    }
}
