package com.example.starter_project_2025.system.git_integration.sync;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncPhase;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubBranch;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository;
import com.example.starter_project_2025.system.git_integration.service.GitInstallationWriter;
import com.example.starter_project_2025.system.git_integration.service.InstallationRepositoryCache;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * GI-04: runs one synchronization job. Every run confirms the installation can still read the
 * repository (by its stable id, so a rename does not matter). The metadata step (once per job)
 * refreshes the snapshot (name, owner, URL, default branch, visibility) and counts the branches;
 * SY-01: the commit step then imports the history of the default branch, resuming from the
 * job's cursor when a previous run stopped.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GitRepositorySyncRunner {

    private static final int PAGE_SIZE = 100;

    private final GitSyncJobStore store;
    private final GitHubApiClient github;
    private final InstallationTokenProvider tokens;
    private final InstallationRepositoryCache cache;
    private final GitInstallationWriter installationWriter;
    private final GitHubAppProperties properties;
    private final CommitHistorySyncStep commitStep;

    public void run(Long jobId) {
        Optional<GitSyncJobStore.ClaimedJob> claimed;
        try {
            claimed = store.claim(jobId);
        } catch (OptimisticLockingFailureException concurrentClaim) {
            return; // another worker took it
        }
        claimed.ifPresent(this::execute);
    }

    private void execute(GitSyncJobStore.ClaimedJob claimed) {
        GitSyncJobStore.ClaimedJob job = claimed;
        boolean commits = false;
        try {
            String token = tokens.token(job.githubInstallationId());
            Optional<GitHubRepository> repository = github.getRepository(token, job.externalId());
            if (repository.isEmpty()) {
                store.repositoryLost(job, "REPOSITORY_NOT_ACCESSIBLE", "The GitHub App can no longer access the repository");
                return;
            }
            if (job.phase() == GitSyncPhase.METADATA) {
                Map<String, Object> stats = new LinkedHashMap<>();
                countBranches(token, repository.get(), stats);
                job = store.startCommits(job, repository.get(), stats);
                log.info("Repository metadata synchronized: jobId={}, repositoryId={}, attempt={}, stats={}",
                        job.jobId(), job.repositoryId(), job.attemptCount(), stats);
            }
            commits = true;
            CommitHistorySyncStep.Outcome outcome = commitStep.run(job, repository.get().ownerLogin(), repository.get().name());
            if (outcome == CommitHistorySyncStep.Outcome.REPOSITORY_LOST) {
                store.repositoryLost(job, "REPOSITORY_NOT_ACCESSIBLE", "The GitHub App can no longer access the repository");
            }
        } catch (GitHubApiException e) {
            handleGitHubFailure(job, e, commits);
        } catch (RuntimeException e) {
            log.warn("Repository sync failed unexpectedly: jobId={}, error={}", job.jobId(), e.getClass().getSimpleName(), e);
            store.retryOrFail(job, "SYNC_ERROR", "Unexpected error while synchronizing");
        }
    }

    private void countBranches(String token, GitHubRepository repository, Map<String, Object> stats) {
        int count = 0;
        boolean truncated = false;
        for (int page = 1; ; page++) {
            List<GitHubBranch> branches = github.listBranches(token, repository.ownerLogin(), repository.name(), page);
            count += branches.size();
            if (branches.size() < PAGE_SIZE) break;
            if (page >= properties.getSyncMaxBranchPages()) {
                truncated = true;
                break;
            }
        }
        stats.put("branches", count);
        if (truncated) stats.put("branchesTruncated", true);
    }

    private void handleGitHubFailure(GitSyncJobStore.ClaimedJob job, GitHubApiException e, boolean commits) {
        switch (e.getKind()) {
            case GONE -> {
                forget(job.githubInstallationId());
                installationWriter.markStatus(job.installationRowId(), GitInstallationStatus.DISCONNECTED, "sync-token-404");
                store.repositoryLost(job, "INSTALLATION_DISCONNECTED", "The GitHub App was uninstalled");
            }
            case SUSPENDED -> {
                forget(job.githubInstallationId());
                installationWriter.markStatus(job.installationRowId(), GitInstallationStatus.SUSPENDED, "sync-token-suspended");
                store.fail(job, "INSTALLATION_SUSPENDED", "The GitHub App installation is suspended");
            }
            case RATE_LIMITED -> store.postpone(job, e.getRetryAfterSeconds());
            case REJECTED -> {
                if (e.getHttpStatus() == 401) {
                    tokens.invalidate(job.githubInstallationId());
                    store.retryOrFail(job, commits ? "HISTORY_UNAVAILABLE" : "PROVIDER_UNAVAILABLE", "GitHub refused the access token");
                } else if (commits) {
                    // 403/422: the App cannot read contents (permission "Contents: Read" missing or revoked).
                    log.warn("Commit history refused: jobId={}, reason={}", job.jobId(), e.getMessage());
                    store.fail(job, "HISTORY_FORBIDDEN", "The GitHub App is not allowed to read the repository contents");
                } else {
                    store.retryOrFail(job, "PROVIDER_UNAVAILABLE", "GitHub could not be reached");
                }
            }
            default -> {
                log.warn("Repository sync attempt failed: jobId={}, attempt={}, reason={}", job.jobId(), job.attemptCount(), e.getMessage());
                store.retryOrFail(job, commits ? "HISTORY_UNAVAILABLE" : "PROVIDER_UNAVAILABLE", "GitHub could not be reached");
            }
        }
    }

    private void forget(long installationId) {
        tokens.invalidate(installationId);
        cache.evict(installationId);
    }
}
