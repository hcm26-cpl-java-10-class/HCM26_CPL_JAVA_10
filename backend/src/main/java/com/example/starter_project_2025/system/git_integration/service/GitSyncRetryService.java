package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import com.example.starter_project_2025.system.git_integration.dto.GitSyncJobView;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.sync.GitSyncJobQueue;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * GI-04 / SY-01: "Sync now" (and "Retry" / "Resume" after a failure). The rules of what is queued
 * live in {@link GitSyncJobQueue}: a job already waiting or running is returned, a PARTIAL or
 * FAILED job resumes from its cursor, a failed INITIAL job is reset, otherwise a MANUAL job reads
 * the commits since the last complete import. Repeated clicks queue nothing.
 * <p>
 * GI-05 "Sync again" of a repository in ERROR or DISCONNECTED (PM of the master or Git
 * Integration manager only): GitHub is asked first, outside any transaction, whether the
 * installation can read the repository again. Yes → ACTIVE and a sync is queued; no → 422
 * {@code GIT_REPOSITORY_NOT_ACCESSIBLE} and nothing changes. One GitHub check per connection
 * every {@value #RECHECK_COOLDOWN_SECONDS} seconds.
 */
@Slf4j
@Service
public class GitSyncRetryService {

    static final long RECHECK_COOLDOWN_SECONDS = 10;

    private final GitIntegrationAccessService access;
    private final GitProjectResolver projectResolver;
    private final GitRepositoryLinkPolicy policy;
    private final GitRepositoryRepository connections;
    private final GitInstallationRepository installations;
    private final GitRepositoryConnectionWriter connectionWriter;
    private final GitSyncJobQueue queue;
    private final ProjectRepositoryQueryService queries;
    private final GitHubApiClient github;
    private final InstallationTokenProvider tokens;
    private final GitHubFailures failures;
    private final GitHubAppProperties properties;
    private final TransactionTemplate transactions;
    private final Clock clock;
    private final Map<Long, LocalDateTime> lastRecheck = new ConcurrentHashMap<>();

    public GitSyncRetryService(GitIntegrationAccessService access, GitProjectResolver projectResolver,
                               GitRepositoryLinkPolicy policy, GitRepositoryRepository connections,
                               GitInstallationRepository installations, GitRepositoryConnectionWriter connectionWriter,
                               GitSyncJobQueue queue, ProjectRepositoryQueryService queries, GitHubApiClient github,
                               InstallationTokenProvider tokens, GitHubFailures failures, GitHubAppProperties properties,
                               TransactionTemplate transactions, @Qualifier("gitIntegrationClock") Clock clock) {
        this.access = access;
        this.projectResolver = projectResolver;
        this.policy = policy;
        this.connections = connections;
        this.installations = installations;
        this.connectionWriter = connectionWriter;
        this.queue = queue;
        this.queries = queries;
        this.github = github;
        this.tokens = tokens;
        this.failures = failures;
        this.properties = properties;
        this.transactions = transactions;
        this.clock = clock;
    }

    /** {@code queued = false} when a job was already waiting or running, or just succeeded. */
    public record RetryResult(GitSyncJobView job, boolean queued) {
    }

    /** What the retry works on, read in a short transaction (walking up to the master loads lazy parents). */
    private record Target(User user, Long connectionId, GitRepositoryStatus status, Long installationRowId,
                          long githubInstallationId, GitInstallationStatus installationStatus, long externalId) {
    }

    public RetryResult retry(Long projectId) {
        if (!properties.isEnabled()) {
            throw GitIntegrationException.disabled();
        }
        User user = access.requireUser();
        Target target = transactions.execute(status -> target(user, projectId));
        if (target.status() == GitRepositoryStatus.ACTIVE) {
            return transactions.execute(status -> queueSync(target));
        }
        verifyAccess(target);
        return transactions.execute(status -> {
            GitRepository row = connections.lockById(target.connectionId())
                    .filter(connection -> connection.getStatus() == target.status())
                    .orElseThrow(GitIntegrationException::repositoryChanged);
            if (!connectionWriter.reactivate(row)) {
                throw GitIntegrationException.repositoryInUse(null); // synchronized by another project meanwhile
            }
            log.info("Repository connection restored by sync again: repositoryId={}, from={}, actorUserId={}",
                    row.getId(), target.status(), user.getId());
            return queueSync(target);
        });
    }

    private Target target(User user, Long projectId) {
        Project project = projectResolver.require(user, projectId);
        Project master = projectResolver.masterOf(project);
        policy.requireCanView(user, project);
        if (!projectResolver.isMaster(project)) {
            throw GitIntegrationException.projectNotMaster(GitProjectResolver.summary(master));
        }
        GitRepository connection = connections.findCurrent(master.getId())
                .orElseThrow(GitIntegrationException::repositoryNotLinked);
        if (connection.getStatus() == GitRepositoryStatus.ACTIVE) {
            policy.requireCanSync(user, master);
        } else {
            policy.requireCanManage(user, master); // GI-05: restoring the connection changes the configuration
        }
        GitInstallation installation = installations.findById(connection.getInstallationRef())
                .orElseThrow(GitIntegrationException::installationNotFound);
        return new Target(user, connection.getId(), connection.getStatus(), installation.getId(),
                installation.getInstallationId(), installation.getStatus(), connection.getExternalId());
    }

    private RetryResult queueSync(Target target) {
        GitSyncJobQueue.Requested requested = queue.request(target.connectionId(), GitSyncJobType.MANUAL, target.user().getId(),
                        LocalDateTime.now(clock))
                .orElseThrow(GitIntegrationException::repositoryNotLinked);
        return new RetryResult(queries.jobView(requested.job()), requested.queued());
    }

    /** GI-05: GitHub must read the repository through its installation again; throws otherwise. */
    private void verifyAccess(Target target) {
        if (target.installationStatus() == GitInstallationStatus.ERROR) {
            throw GitIntegrationException.installationError();
        }
        if (target.installationStatus() != GitInstallationStatus.CONNECTED) {
            throw GitIntegrationException.installationNotActive(target.installationStatus().name());
        }
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDateTime previous = lastRecheck.get(target.connectionId());
        if (previous != null && previous.isAfter(now.minusSeconds(RECHECK_COOLDOWN_SECONDS))) {
            throw GitIntegrationException.recheckTooSoon();
        }
        lastRecheck.put(target.connectionId(), now);
        Optional<GitHubRepository> repository;
        try {
            repository = github.getRepository(tokens.token(target.githubInstallationId()), target.externalId());
        } catch (GitHubApiException e) {
            throw failures.toBusinessError(target.installationRowId(), target.githubInstallationId(), e, "resync-repository");
        }
        if (repository.isEmpty()) {
            throw GitIntegrationException.repositoryNotAccessible();
        }
    }
}
