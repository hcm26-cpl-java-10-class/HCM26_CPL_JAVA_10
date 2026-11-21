package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJob;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.dto.GitSyncJobView;
import com.example.starter_project_2025.system.git_integration.dto.ProjectRepositoryView;
import com.example.starter_project_2025.system.git_integration.repository.GitCommitRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
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

import java.util.Map;

/**
 * GI-04: the repository of a project as shown in the Workspace. A module shows
 * its master project's repository ({@code inherited = true}).
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
    private final UserRepository users;
    private final ObjectMapper json;

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

        // The ACTIVE connection, or the latest one when it became UNAVAILABLE (so the UI can say so).
        GitRepository connection = connections.findFirstByProjectIdAndStatus(master.getId(), GitRepositoryStatus.ACTIVE)
                .or(() -> connections.findFirstByProjectIdOrderByIdDesc(master.getId())
                        .filter(row -> row.getStatus() == GitRepositoryStatus.UNAVAILABLE))
                .orElse(null);
        GitSyncJob latestSync = connection == null ? null
                : jobs.findFirstByRepositoryIdOrderByIdDesc(connection.getId()).orElse(null);

        boolean active = connection != null && connection.getStatus() == GitRepositoryStatus.ACTIVE;
        boolean manage = policy.canLink(user, master);
        boolean canLink = !inherited && !active && manage && projectResolver.isLinkable(master);
        // SY-01: "Sync now" is offered at any time; a sync already waiting or running is returned as is.
        boolean canSync = !inherited && active && policy.canSync(user, master);

        return new ProjectRepositoryView(
                new ProjectRepositoryView.ProjectRef(project.getId(), project.getCode(), project.getName(), !inherited),
                new ProjectRepositoryView.MasterRef(master.getId(), master.getCode(), master.getName(),
                        String.valueOf(master.getStatus()), projectResolver.moduleCount(master)),
                inherited,
                connection == null ? null : repositoryView(connection),
                latestSync == null ? null : jobView(latestSync),
                canLink,
                canSync);
    }

    private ProjectRepositoryView.RepositoryView repositoryView(GitRepository row) {
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
                commits.countByRepositoryId(row.getId()), row.getCommitHistorySyncedAt());
    }

    GitSyncJobView jobView(GitSyncJob job) {
        Map<String, Object> stats = stats(job.getStatsJson());
        boolean resumable = job.getCommitCursor() != null
                && (job.getStatus() == GitSyncJobStatus.PARTIAL || job.getStatus() == GitSyncJobStatus.FAILED);
        boolean paused = job.getStatus() == GitSyncJobStatus.PENDING && "RATE_LIMITED".equals(job.getErrorCode());
        return new GitSyncJobView(job.getId(), job.getType(), job.getStatus(), job.getAttemptCount(),
                job.getMaxAttempts(), job.getNextRunAt(), job.getStartedAt(), job.getFinishedAt(),
                job.getErrorCode(), stats, job.effectivePhase(),
                new GitSyncJobView.Progress(job.pages(), number(stats, "commitsInserted"), number(stats, "commitsExisting"),
                        number(stats, "commitsEnriched")),
                resumable, paused ? job.getNextRunAt() : null);
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
