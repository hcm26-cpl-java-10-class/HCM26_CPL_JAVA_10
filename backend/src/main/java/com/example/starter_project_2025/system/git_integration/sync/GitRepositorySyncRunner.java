package com.example.starter_project_2025.system.git_integration.sync;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncPhase;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubBranch;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository;
import com.example.starter_project_2025.system.git_integration.service.InstallationHealth;
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
 * SY-01: the commit step then imports the history of the default branch; SY-02: the pull request
 * step imports pull requests and their reviews. A job resumes at the step (and cursor) where a
 * previous run stopped; both steps share the run's page budget ({@code sync-max-pages-per-run}).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GitRepositorySyncRunner {

    private static final int PAGE_SIZE = 100;

    private final GitSyncJobStore store;
    private final GitHubApiClient github;
    private final InstallationTokenProvider tokens;
    private final InstallationHealth health;
    private final GitHubAppProperties properties;
    private final CommitHistorySyncStep commitStep;
    private final PullRequestSyncStep pullRequestStep;

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
        GitSyncPhase step = GitSyncPhase.METADATA;
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
            String owner = repository.get().ownerLogin();
            String name = repository.get().name();
            int budget = properties.getSyncMaxPagesPerRun();
            if (job.phase() == GitSyncPhase.METADATA || job.phase() == GitSyncPhase.COMMITS) {
                step = GitSyncPhase.COMMITS;
                SyncStepResult commits = commitStep.run(job, owner, name, budget);
                if (commits.outcome() != SyncStepResult.Outcome.DONE) {
                    finishStep(commits);
                    return;
                }
                job = commits.job();
                budget -= commits.pages();
                if (budget <= 0) {
                    store.yieldRun(job); // the pull request step starts in the next run
                    return;
                }
            }
            step = GitSyncPhase.PULL_REQUESTS;
            finishStep(pullRequestStep.run(job, owner, name, budget));
        } catch (GitHubApiException e) {
            handleGitHubFailure(job, e, step);
        } catch (RuntimeException e) {
            log.warn("Repository sync failed unexpectedly: jobId={}, error={}", job.jobId(), e.getClass().getSimpleName(), e);
            store.retryOrFail(job, "SYNC_ERROR", "Unexpected error while synchronizing");
        }
    }

    private void finishStep(SyncStepResult result) {
        if (result.outcome() == SyncStepResult.Outcome.REPOSITORY_LOST) {
            store.repositoryLost(result.job(), "REPOSITORY_NOT_ACCESSIBLE", "The GitHub App can no longer access the repository");
        } else if (result.outcome() == SyncStepResult.Outcome.REPOSITORY_STOPPED) {
            store.stopped(result.job());
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

    private void handleGitHubFailure(GitSyncJobStore.ClaimedJob job, GitHubApiException e, GitSyncPhase step) {
        String unavailable = switch (step) {
            case COMMITS -> "HISTORY_UNAVAILABLE";
            case PULL_REQUESTS -> "PULL_REQUESTS_UNAVAILABLE";
            default -> "PROVIDER_UNAVAILABLE";
        };
        switch (e.getKind()) {
            case GONE -> {
                // GI-02: ERROR, not DISCONNECTED: the repository stays linked until GitHub confirms the removal.
                health.failed(job.installationRowId(), job.githubInstallationId(), e);
                store.fail(job, "INSTALLATION_ERROR", "GitHub refused the connection; check the GitHub connection");
            }
            case SUSPENDED -> {
                health.failed(job.installationRowId(), job.githubInstallationId(), e);
                store.fail(job, "INSTALLATION_SUSPENDED", "The GitHub App installation is suspended");
            }
            case RATE_LIMITED -> store.postpone(job, e.getRetryAfterSeconds());
            case REJECTED -> {
                if (e.getHttpStatus() == 401) {
                    GitInstallationStatus broken = health.failed(job.installationRowId(), job.githubInstallationId(), e);
                    if (broken == GitInstallationStatus.ERROR) {
                        store.fail(job, "INSTALLATION_ERROR", "GitHub refused the connection; check the GitHub connection");
                    } else {
                        store.retryOrFail(job, unavailable, "GitHub refused the access token"); // first 401: a fresh token next time
                    }
                } else if (step == GitSyncPhase.COMMITS) {
                    // 403/422: the App cannot read contents (permission "Contents: Read" missing or revoked).
                    log.warn("Commit history refused: jobId={}, reason={}", job.jobId(), e.getMessage());
                    store.fail(job, "HISTORY_FORBIDDEN", "The GitHub App is not allowed to read the repository contents");
                } else if (step == GitSyncPhase.PULL_REQUESTS) {
                    // The App lacks "Pull requests: Read"; the commits already imported are kept (PARTIAL).
                    log.warn("Pull requests refused: jobId={}, reason={}", job.jobId(), e.getMessage());
                    store.fail(job, "PULL_REQUESTS_FORBIDDEN", "The GitHub App is not allowed to read the pull requests");
                } else {
                    store.retryOrFail(job, "PROVIDER_UNAVAILABLE", "GitHub could not be reached");
                }
            }
            default -> {
                log.warn("Repository sync attempt failed: jobId={}, attempt={}, reason={}", job.jobId(), job.attemptCount(), e.getMessage());
                store.retryOrFail(job, unavailable, "GitHub could not be reached");
            }
        }
    }
}
