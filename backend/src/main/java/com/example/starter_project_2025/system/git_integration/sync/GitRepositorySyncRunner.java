package com.example.starter_project_2025.system.git_integration.sync;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
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
 * GI-04: runs one synchronization job. The initial sync confirms the
 * installation can still read the repository, refreshes its snapshot (name,
 * owner, URL, default branch, visibility) and counts its branches. Later US add
 * steps (commits, pull requests) here.
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

    public void run(Long jobId) {
        Optional<GitSyncJobStore.ClaimedJob> claimed;
        try {
            claimed = store.claim(jobId);
        } catch (OptimisticLockingFailureException concurrentClaim) {
            return; // another worker took it
        }
        claimed.ifPresent(this::execute);
    }

    private void execute(GitSyncJobStore.ClaimedJob job) {
        try {
            String token = tokens.token(job.githubInstallationId());
            Optional<GitHubRepository> repository = github.getRepository(token, job.externalId());
            if (repository.isEmpty()) {
                store.repositoryLost(job, "REPOSITORY_NOT_ACCESSIBLE", "The GitHub App can no longer access the repository");
                return;
            }
            Map<String, Object> stats = new LinkedHashMap<>();
            countBranches(token, repository.get(), stats);
            store.succeed(job, repository.get(), stats);
            log.info("Repository sync succeeded: jobId={}, repositoryId={}, attempt={}, stats={}",
                    job.jobId(), job.repositoryId(), job.attemptCount(), stats);
        } catch (GitHubApiException e) {
            handleGitHubFailure(job, e);
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

    private void handleGitHubFailure(GitSyncJobStore.ClaimedJob job, GitHubApiException e) {
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
            default -> {
                if (e.getHttpStatus() == 401) tokens.invalidate(job.githubInstallationId());
                log.warn("Repository sync attempt failed: jobId={}, attempt={}, reason={}", job.jobId(), job.attemptCount(), e.getMessage());
                store.retryOrFail(job, "PROVIDER_UNAVAILABLE", "GitHub could not be reached");
            }
        }
    }

    private void forget(long installationId) {
        tokens.invalidate(installationId);
        cache.evict(installationId);
    }
}
