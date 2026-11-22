package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJob;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.dto.GitSyncJobView;
import com.example.starter_project_2025.system.git_integration.dto.ProjectRepositoryView;
import com.example.starter_project_2025.system.git_integration.repository.GitCommitRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.git_integration.sync.GitSyncJobQueue;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitSyncJobRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * GI-04: the repository of a project as shown in the Workspace. A module shows
 * its master project's repository ({@code inherited = true}), read-only (GI-05 AC05).
 */
@Service
@RequiredArgsConstructor
public class ProjectRepositoryQueryService {

    private final GitIntegrationAccessService access;
    private final GitProjectResolver projectResolver;
    private final GitRepositoryLinkPolicy policy;
    private final GitRepositoryRepository connections;
    private final GitSyncJobRepository jobs;
    private final GitInstallationRepository installations;
    private final GitCommitRepository commits;
    private final GitPullRequestRepository pullRequests;
    private final UserRepository users;
    private final ObjectMapper json;
    private final GitRepositoryLinkWriter linkWriter;

    @Transactional(readOnly = true)
    public ProjectRepositoryView view(Long projectId) {
        return view(access.requireUser(), projectId);
    }

    @Transactional(readOnly = true)
    public ProjectRepositoryView view(User user, Long projectId) {
        Project project = projectResolver.require(user, projectId);
        policy.requireCanView(user, project);
        Project master = projectResolver.masterOf(project);
        boolean inherited = !master.getId().equals(project.getId());

        // GI-05: the current repository (ACTIVE, ERROR or DISCONNECTED); the unlinked ones are listed apart.
        List<GitRepository> all = connections.findByProjectIdOrderByLinkedAtDescIdDesc(master.getId());
        GitRepository connection = all.stream().filter(row -> row.getStatus().holdsProject()).findFirst().orElse(null);
        List<GitRepository> previous = all.stream().filter(row -> row.getStatus() == GitRepositoryStatus.INACTIVE).toList();
        GitSyncJob latestSync = connection == null ? null
                : jobs.findFirstByRepositoryIdOrderByIdDesc(connection.getId()).orElse(null);

        GitRepositoryStatus status = connection == null ? null : connection.getStatus();
        boolean manage = !inherited && policy.canManage(user, master);
        // GI-07: a repository stranded on a disconnected installation can only be linked again (BR7).
        boolean installationGone = connection != null && linkWriter.installationGone(connection);
        boolean canLink = manage && (connection == null || installationGone) && projectResolver.isLinkable(master);
        // SY-01: "Sync now" is offered at any time; a sync already waiting or running is returned as is.
        boolean canSync = !inherited && status == GitRepositoryStatus.ACTIVE && policy.canSync(user, master);
        boolean canResync = manage && !installationGone
                && (status == GitRepositoryStatus.ERROR || status == GitRepositoryStatus.DISCONNECTED);
        boolean canUnlink = manage && connection != null;

        return new ProjectRepositoryView(
                new ProjectRepositoryView.ProjectRef(project.getId(), project.getCode(), project.getName(), !inherited),
                new ProjectRepositoryView.MasterRef(master.getId(), master.getCode(), master.getName(),
                        String.valueOf(master.getStatus()), projectResolver.moduleCount(master)),
                inherited,
                connection == null ? null : repositoryView(connection, installationGone),
                latestSync == null ? null : jobView(latestSync),
                canLink,
                canSync,
                canResync,
                canUnlink,
                previous.stream().map(this::previousView).toList(),
                !all.isEmpty() && policy.canManage(user, master));
    }

    private ProjectRepositoryView.RepositoryView repositoryView(GitRepository row, boolean installationGone) {
        ProjectRepositoryView.InstallationRef installation = installations.findById(row.getInstallationRef())
                .map(item -> new ProjectRepositoryView.InstallationRef(item.getId(), item.getAccountLogin(),
                        item.getAccountType(), item.getStatus()))
                .orElse(null);
        ProjectRepositoryView.UserRef linkedBy = users.findById(row.getLinkedByUserId())
                .map(user -> new ProjectRepositoryView.UserRef(user.getId(), user.getFullName()))
                .orElse(new ProjectRepositoryView.UserRef(row.getLinkedByUserId(), null));
        return new ProjectRepositoryView.RepositoryView(row.getId(), row.getExternalId(), row.getOwnerLogin(),
                row.getName(), row.getFullName(), row.getHtmlUrl(), row.getVisibility(), row.getDefaultBranch(),
                row.getStatus(), installation, linkedBy, row.getLinkedAt(), row.getLastSyncedAt(),
                commits.countByRepositoryId(row.getId()), row.getCommitHistorySyncedAt(),
                pullRequests.countByRepositoryId(row.getId()), row.getPullRequestsSyncedAt(),
                row.getStatusReason(), row.getStatusChangedAt(), installationGone);
    }

    private ProjectRepositoryView.PreviousRepository previousView(GitRepository row) {
        ProjectRepositoryView.UserRef unlinkedBy = row.getUnlinkedByUserId() == null ? null
                : users.findById(row.getUnlinkedByUserId())
                .map(user -> new ProjectRepositoryView.UserRef(user.getId(), user.getFullName()))
                .orElse(new ProjectRepositoryView.UserRef(row.getUnlinkedByUserId(), null));
        return new ProjectRepositoryView.PreviousRepository(row.getId(), row.getFullName(), row.getHtmlUrl(),
                row.getLinkedAt(), row.getUnlinkedAt(), unlinkedBy,
                commits.countByRepositoryId(row.getId()), pullRequests.countByRepositoryId(row.getId()));
    }

    GitSyncJobView jobView(GitSyncJob job) {
        Map<String, Object> stats = stats(job.getStatsJson());
        boolean resumable = GitSyncJobQueue.resumable(job);
        boolean paused = job.getStatus() == GitSyncJobStatus.PENDING && "RATE_LIMITED".equals(job.getErrorCode());
        return new GitSyncJobView(job.getId(), job.getType(), job.getStatus(), job.getAttemptCount(),
                job.getMaxAttempts(), job.getNextRunAt(), job.getStartedAt(), job.getFinishedAt(),
                job.getErrorCode(), stats, job.effectivePhase(),
                new GitSyncJobView.Progress(job.pages(), number(stats, "commitsInserted"), number(stats, "commitsExisting"),
                        number(stats, "commitsEnriched"),
                        new GitSyncJobView.PullRequests(job.prPages(), number(stats, "pullRequestsInserted"),
                                number(stats, "pullRequestsUpdated"), number(stats, "pullRequestsUnchanged")),
                        new GitSyncJobView.Reviews(number(stats, "reviewsInserted"), number(stats, "reviewsUpdated"))),
                resumable, paused ? job.getNextRunAt() : null, job.getResumedFromJobId());
    }

    private static long number(Map<String, Object> stats, String key) {
        return stats.get(key) instanceof Number value ? value.longValue() : 0;
    }

    private Map<String, Object> stats(String statsJson) {
        if (statsJson == null || statsJson.isBlank()) return Map.of();
        try {
            return json.readValue(statsJson, new TypeReference<Map<String, Object>>() { });
        } catch (JsonProcessingException e) {
            return Map.of();
        }
    }
}
