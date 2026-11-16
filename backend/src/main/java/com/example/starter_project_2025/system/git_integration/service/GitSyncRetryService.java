package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJob;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import com.example.starter_project_2025.system.git_integration.dto.GitSyncJobView;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitSyncJobRepository;
import com.example.starter_project_2025.system.git_integration.sync.GitSyncJobRequested;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.rbac.user.User;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * GI-04: "Retry sync" after a synchronization gave up. A failed INITIAL job is
 * reset (a connection has exactly one); otherwise a MANUAL job is queued. A job
 * already PENDING/RUNNING is returned as is, so repeated clicks queue nothing.
 */
@Service
public class GitSyncRetryService {

    private final GitIntegrationAccessService access;
    private final GitProjectResolver projectResolver;
    private final GitRepositoryLinkPolicy policy;
    private final GitRepositoryRepository connections;
    private final GitSyncJobRepository jobs;
    private final ProjectRepositoryQueryService queries;
    private final ApplicationEventPublisher events;
    private final GitHubAppProperties properties;
    private final Clock clock;

    public GitSyncRetryService(GitIntegrationAccessService access, GitProjectResolver projectResolver,
                               GitRepositoryLinkPolicy policy, GitRepositoryRepository connections,
                               GitSyncJobRepository jobs, ProjectRepositoryQueryService queries,
                               ApplicationEventPublisher events, GitHubAppProperties properties,
                               @Qualifier("gitIntegrationClock") Clock clock) {
        this.access = access;
        this.projectResolver = projectResolver;
        this.policy = policy;
        this.connections = connections;
        this.jobs = jobs;
        this.queries = queries;
        this.events = events;
        this.properties = properties;
        this.clock = clock;
    }

    /** {@code queued = false} when a job was already waiting or running. */
    public record RetryResult(GitSyncJobView job, boolean queued) {
    }

    @Transactional
    public RetryResult retry(Long projectId) {
        if (!properties.isEnabled()) {
            throw GitIntegrationException.disabled();
        }
        User user = access.requireUser();
        Project project = projectResolver.require(user, projectId);
        policy.requireCanLink(user, projectResolver.masterOf(project));
        if (!projectResolver.isMaster(project)) {
            throw GitIntegrationException.projectNotMaster(GitProjectResolver.summary(projectResolver.masterOf(project)));
        }
        GitRepository connection = connections.findFirstByProjectIdAndStatus(project.getId(), GitRepositoryStatus.ACTIVE)
                .orElseThrow(GitIntegrationException::repositoryNotLinked);

        Optional<GitSyncJob> latest = jobs.findFirstByRepositoryIdOrderByIdDesc(connection.getId());
        if (latest.isPresent() && latest.get().getStatus().inProgress()) {
            return new RetryResult(queries.jobView(latest.get()), false);
        }

        LocalDateTime now = LocalDateTime.now(clock);
        GitSyncJob job = jobs.findByDedupeKey(GitRepositoryLinkWriter.initialDedupeKey(connection.getId()))
                .filter(initial -> initial.getStatus() == GitSyncJobStatus.FAILED)
                .orElse(null);
        if (job != null) {
            job.setStatus(GitSyncJobStatus.PENDING);
            job.setAttemptCount(0);
            job.setNextRunAt(now);
            job.setStartedAt(null);
            job.setFinishedAt(null);
            job.setErrorCode(null);
            job.setErrorMessage(null);
            job.setRequestedByUserId(user.getId());
        } else {
            job = GitSyncJob.builder()
                    .tenantId(connection.getTenantId())
                    .repositoryId(connection.getId())
                    .type(GitSyncJobType.MANUAL)
                    .status(GitSyncJobStatus.PENDING)
                    .maxAttempts(properties.getSyncMaxAttempts())
                    .nextRunAt(now)
                    .requestedByUserId(user.getId())
                    .build();
        }
        job = jobs.saveAndFlush(job);
        events.publishEvent(new GitSyncJobRequested(job.getId()));
        return new RetryResult(queries.jobView(job), true);
    }
}
