package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import com.example.starter_project_2025.system.git_integration.dto.GitSyncJobView;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.sync.GitSyncJobQueue;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.rbac.user.User;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;

/**
 * GI-04 / SY-01: "Sync now" (and "Retry" / "Resume" after a failure). The rules of what is queued
 * live in {@link GitSyncJobQueue}: a job already waiting or running is returned, a PARTIAL or
 * FAILED job resumes from its cursor, a failed INITIAL job is reset, otherwise a MANUAL job reads
 * the commits since the last complete import. Repeated clicks queue nothing.
 */
@Service
public class GitSyncRetryService {

    private final GitIntegrationAccessService access;
    private final GitProjectResolver projectResolver;
    private final GitRepositoryLinkPolicy policy;
    private final GitRepositoryRepository connections;
    private final GitSyncJobQueue queue;
    private final ProjectRepositoryQueryService queries;
    private final GitHubAppProperties properties;
    private final Clock clock;

    public GitSyncRetryService(GitIntegrationAccessService access, GitProjectResolver projectResolver,
                               GitRepositoryLinkPolicy policy, GitRepositoryRepository connections,
                               GitSyncJobQueue queue, ProjectRepositoryQueryService queries,
                               GitHubAppProperties properties, @Qualifier("gitIntegrationClock") Clock clock) {
        this.access = access;
        this.projectResolver = projectResolver;
        this.policy = policy;
        this.connections = connections;
        this.queue = queue;
        this.queries = queries;
        this.properties = properties;
        this.clock = clock;
    }

    /** {@code queued = false} when a job was already waiting or running, or just succeeded. */
    public record RetryResult(GitSyncJobView job, boolean queued) {
    }

    @Transactional
    public RetryResult retry(Long projectId) {
        if (!properties.isEnabled()) {
            throw GitIntegrationException.disabled();
        }
        User user = access.requireUser();
        Project project = projectResolver.require(user, projectId);
        policy.requireCanSync(user, projectResolver.masterOf(project));
        if (!projectResolver.isMaster(project)) {
            throw GitIntegrationException.projectNotMaster(GitProjectResolver.summary(projectResolver.masterOf(project)));
        }
        GitRepository connection = connections.findFirstByProjectIdAndStatus(project.getId(), GitRepositoryStatus.ACTIVE)
                .orElseThrow(GitIntegrationException::repositoryNotLinked);
        GitSyncJobQueue.Requested requested = queue.request(connection.getId(), GitSyncJobType.MANUAL, user.getId(),
                        LocalDateTime.now(clock))
                .orElseThrow(GitIntegrationException::repositoryNotLinked);
        return new RetryResult(queries.jobView(requested.job()), requested.queued());
    }
}
