package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.dto.ProjectRepositoryView;
import com.example.starter_project_2025.system.git_integration.dto.UnlinkRepositoryRequest;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitProjectLookupRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitSyncJobRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.rbac.user.User;
import java.time.Clock;
import java.time.LocalDateTime;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * GI-05: unlink the repository of a master project.
 * <ul>
 *   <li>Only a PM of the master or a Git Integration manager (AC03: 403, nothing changes).</li>
 *   <li>A module never unlinks: it shows its master's repository read-only (AC05).</li>
 *   <li>The connection becomes INACTIVE with {@code unlinked_by/at}; no synchronized data is
 *       deleted and it stays in the project's analytics (AC02). Waiting sync jobs stop, a running
 *       one stops at its next page, and later webhooks of the repository are ignored.</li>
 *   <li>Idempotent: unlinking an INACTIVE connection again returns the view.</li>
 * </ul>
 * GitHub is not called: the App installation and its webhooks may serve other projects.
 */
@Slf4j
@Service
public class GitRepositoryUnlinkService {

    private final GitHubAppProperties properties;
    private final GitIntegrationAccessService access;
    private final GitProjectResolver projectResolver;
    private final GitProjectLookupRepository projects;
    private final GitRepositoryLinkPolicy policy;
    private final GitRepositoryRepository connections;
    private final GitRepositoryConnectionWriter connectionWriter;
    private final GitSyncJobRepository jobs;
    private final GitInstallationRepository installations;
    private final InstallationRepositoryCache cache;
    private final ProjectRepositoryQueryService queries;
    private final Clock clock;

    public GitRepositoryUnlinkService(GitHubAppProperties properties, GitIntegrationAccessService access,
                                      GitProjectResolver projectResolver, GitProjectLookupRepository projects,
                                      GitRepositoryLinkPolicy policy, GitRepositoryRepository connections,
                                      GitRepositoryConnectionWriter connectionWriter, GitSyncJobRepository jobs,
                                      GitInstallationRepository installations, InstallationRepositoryCache cache,
                                      ProjectRepositoryQueryService queries, @Qualifier("gitIntegrationClock") Clock clock) {
        this.properties = properties;
        this.access = access;
        this.projectResolver = projectResolver;
        this.projects = projects;
        this.policy = policy;
        this.connections = connections;
        this.connectionWriter = connectionWriter;
        this.jobs = jobs;
        this.installations = installations;
        this.cache = cache;
        this.queries = queries;
        this.clock = clock;
    }

    @Transactional
    public ProjectRepositoryView unlink(Long projectId, UnlinkRepositoryRequest request) {
        if (!properties.isEnabled()) {
            throw GitIntegrationException.disabled();
        }
        User user = access.requireUser();
        Project project = projectResolver.require(user, projectId);
        Project master = projectResolver.masterOf(project);
        policy.requireCanView(user, project);
        if (!projectResolver.isMaster(project)) {
            throw GitIntegrationException.projectNotMaster(GitProjectResolver.summary(master));
        }
        policy.requireCanManage(user, master); // AC03: before anything is written

        projects.lockById(master.getId()).orElseThrow(GitIntegrationException::projectNotFound); // vs a concurrent link / unlink
        GitRepository row = connections.findById(request.repositoryId())
                .filter(connection -> connection.getProjectId().equals(master.getId()))
                .filter(connection -> connection.getTenantId().equals(user.getTenant().getId()))
                .orElseThrow(GitIntegrationException::repositoryNotLinked);
        if (row.getStatus() == GitRepositoryStatus.INACTIVE) {
            return queries.view(user, projectId); // already unlinked (retry, double click)
        }
        GitRepository current = connections.findCurrent(master.getId()).orElse(null);
        if (current == null || !current.getId().equals(row.getId())) {
            throw GitIntegrationException.repositoryChanged();
        }

        connectionWriter.unlink(row, user.getId());
        LocalDateTime now = LocalDateTime.now(clock);
        int stopped = 0;
        for (var job : jobs.findByRepository_IdAndStatus(row.getId(), GitSyncJobStatus.PENDING)) {
            job.setStatus(GitSyncJobStatus.FAILED);
            job.setFinishedAt(now);
            job.setErrorCode("REPOSITORY_UNLINKED");
            job.setErrorMessage("The repository was unlinked from the project");
            stopped++;
        }
        evictAfterCommit(row.getInstallationRef());
        log.info("Repository unlinked: tenantId={}, projectId={}, repositoryId={}, externalId={}, fullName={}, stoppedJobs={}, actorUserId={}",
                row.getTenantId(), master.getId(), row.getId(), row.getExternalId(), row.getFullName(), stopped, user.getId());
        return queries.view(user, projectId);
    }

    /** GI-03 marks repositories already linked in its (cached) list: drop it once the unlink is committed. */
    private void evictAfterCommit(Long installationRowId) {
        Long githubInstallationId = installations.findById(installationRowId).map(GitInstallation::getInstallationId).orElse(null);
        if (githubInstallationId == null) return;
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            cache.evict(githubInstallationId);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                cache.evict(githubInstallationId);
            }
        });
    }
}
