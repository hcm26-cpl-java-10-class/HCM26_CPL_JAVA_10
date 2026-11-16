package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJob;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import com.example.starter_project_2025.system.git_integration.dto.GitLinkDetails;
import com.example.starter_project_2025.system.git_integration.dto.LinkRepositoryRequest;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitProjectLookupRepository;
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
 * GI-04: the transactional halves of linking a repository. {@link #check} runs
 * before GitHub is called; {@link #create} runs after, locks the master project,
 * re-checks (things may have changed meanwhile) and writes the connection
 * together with its initial sync job.
 */
@Service
public class GitRepositoryLinkWriter {

    private final GitProjectResolver projectResolver;
    private final GitProjectLookupRepository projects;
    private final GitRepositoryLinkPolicy policy;
    private final GitInstallationRepository installations;
    private final GitRepositoryRepository connections;
    private final GitSyncJobRepository jobs;
    private final ApplicationEventPublisher events;
    private final GitHubAppProperties properties;
    private final Clock clock;

    public GitRepositoryLinkWriter(GitProjectResolver projectResolver, GitProjectLookupRepository projects,
                                   GitRepositoryLinkPolicy policy, GitInstallationRepository installations,
                                   GitRepositoryRepository connections, GitSyncJobRepository jobs,
                                   ApplicationEventPublisher events, GitHubAppProperties properties,
                                   @Qualifier("gitIntegrationClock") Clock clock) {
        this.projectResolver = projectResolver;
        this.projects = projects;
        this.policy = policy;
        this.installations = installations;
        this.connections = connections;
        this.jobs = jobs;
        this.events = events;
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * Everything the link needs from the database, validated.
     * {@code existingConnectionId} is set when this repository is already ACTIVE on this project.
     */
    public record Plan(Long projectId, Long tenantId, Long installationRowId, long githubInstallationId,
                       Long externalId, Long existingConnectionId) {
    }

    public record Created(GitRepository connection, GitSyncJob initialSync) {
    }

    @Transactional(readOnly = true)
    public Plan check(User user, Long projectId, LinkRepositoryRequest request) {
        Project project = projectResolver.require(user, projectId);
        policy.requireCanLink(user, projectResolver.masterOf(project));
        projectResolver.requireLinkableMaster(project);

        Long tenantId = user.getTenant().getId();
        GitInstallation installation = installations.findById(request.installationId())
                .filter(row -> row.getTenantId().equals(tenantId) && Boolean.TRUE.equals(row.getIsActive()))
                .orElseThrow(GitIntegrationException::installationNotFound);
        if (installation.getStatus() != GitInstallationStatus.CONNECTED) {
            throw GitIntegrationException.installationNotActive(installation.getStatus().name());
        }

        Long existing = existingOrConflict(project.getId(), request.externalId(), tenantId)
                .map(GitRepository::getId).orElse(null);
        return new Plan(project.getId(), tenantId, installation.getId(), installation.getInstallationId(),
                request.externalId(), existing);
    }

    /** Writes the ACTIVE connection and its INITIAL sync job; returns the existing connection when already linked. */
    @Transactional
    public Optional<Created> create(User user, Plan plan, GitHubRepository repository) {
        Project master = projects.lockById(plan.projectId()).orElseThrow(GitIntegrationException::projectNotFound);
        projectResolver.requireLinkableMaster(master);
        if (existingOrConflict(master.getId(), plan.externalId(), plan.tenantId()).isPresent()) {
            return Optional.empty();
        }

        LocalDateTime now = LocalDateTime.now(clock);
        GitRepository connection = connections.saveAndFlush(GitRepository.builder()
                .tenantId(plan.tenantId())
                .projectId(master.getId())
                .installationRef(plan.installationRowId())
                .provider(GitProvider.GITHUB)
                .externalId(repository.id())
                .ownerLogin(repository.ownerLogin())
                .name(repository.name())
                .fullName(repository.fullName())
                .htmlUrl(repository.htmlUrl())
                .visibility(repository.resolvedVisibility())
                .defaultBranch(repository.defaultBranch())
                .status(GitRepositoryStatus.ACTIVE)
                .linkedByUserId(user.getId())
                .linkedAt(now)
                .build());

        GitSyncJob job = jobs.saveAndFlush(GitSyncJob.builder()
                .tenantId(plan.tenantId())
                .repositoryId(connection.getId())
                .type(GitSyncJobType.INITIAL)
                .status(GitSyncJobStatus.PENDING)
                .dedupeKey(initialDedupeKey(connection.getId()))
                .maxAttempts(properties.getSyncMaxAttempts())
                .nextRunAt(now)
                .requestedByUserId(user.getId())
                .build());
        events.publishEvent(new GitSyncJobRequested(job.getId()));
        return Optional.of(new Created(connection, job));
    }

    static String initialDedupeKey(Long repositoryId) {
        return GitSyncJobType.INITIAL.name() + ":" + repositoryId;
    }

    /**
     * Empty when the link may proceed; the connection itself when this repository is already
     * ACTIVE on this project (idempotent retry). Throws AC02 / AC03 otherwise.
     */
    private Optional<GitRepository> existingOrConflict(Long projectId, Long externalId, Long tenantId) {
        Optional<GitRepository> current = connections.findFirstByProjectIdAndStatus(projectId, GitRepositoryStatus.ACTIVE);
        if (current.isPresent()) {
            if (current.get().getExternalId().equals(externalId)) {
                return current;
            }
            GitRepository linked = current.get();
            throw GitIntegrationException.projectAlreadyLinked(new GitLinkDetails.RepositorySummary(
                    linked.getExternalId(), linked.getFullName(), linked.getHtmlUrl(), linked.getDefaultBranch()));
        }
        Optional<GitRepository> elsewhere = connections.findFirstByProviderAndExternalIdAndStatus(
                GitProvider.GITHUB, externalId, GitRepositoryStatus.ACTIVE);
        if (elsewhere.isPresent()) {
            // A project of another tenant is never named (not even by id).
            GitLinkDetails.ProjectSummary linkedProject = projects.findById(elsewhere.get().getProjectId())
                    .filter(project -> tenantId.equals(project.getTenantId()))
                    .map(GitProjectResolver::summary)
                    .orElse(null);
            throw GitIntegrationException.repositoryInUse(linkedProject);
        }
        return Optional.empty();
    }
}
