package com.example.starter_project_2025.system.git_integration.sync;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJob;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitSyncJobRepository;
import com.example.starter_project_2025.system.git_integration.service.GitRepositoryConnectionWriter;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * GI-04: every state change of a sync job, each in a short transaction of its
 * own so a worker never holds a transaction while GitHub is being called.
 * Concurrent workers are kept apart by the job's {@code @Version}.
 */
@Slf4j
@Service
public class GitSyncJobStore {

    /** Wait before attempt 2, 3, … (the last value repeats). */
    private static final List<Duration> BACKOFF = List.of(Duration.ofMinutes(1), Duration.ofMinutes(5), Duration.ofMinutes(15));

    private final GitSyncJobRepository jobs;
    private final GitRepositoryRepository connections;
    private final GitInstallationRepository installations;
    private final GitRepositoryConnectionWriter connectionWriter;
    private final GitHubAppProperties properties;
    private final ObjectMapper json;
    private final Clock clock;

    public GitSyncJobStore(GitSyncJobRepository jobs, GitRepositoryRepository connections,
                           GitInstallationRepository installations, GitRepositoryConnectionWriter connectionWriter,
                           GitHubAppProperties properties, ObjectMapper json, @Qualifier("gitIntegrationClock") Clock clock) {
        this.jobs = jobs;
        this.connections = connections;
        this.installations = installations;
        this.connectionWriter = connectionWriter;
        this.properties = properties;
        this.json = json;
        this.clock = clock;
    }

    /** What a worker needs to run a job it has claimed. */
    public record ClaimedJob(Long jobId, Long repositoryId, Long installationRowId, long githubInstallationId,
                             long externalId, int attemptCount, int maxAttempts) {
    }

    /** PENDING + due → RUNNING. Empty when the job is not runnable (or the connection/installation no longer is). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<ClaimedJob> claim(Long jobId) {
        GitSyncJob job = jobs.findById(jobId).orElse(null);
        LocalDateTime now = now();
        if (job == null || job.getStatus() != GitSyncJobStatus.PENDING || job.getNextRunAt().isAfter(now)) {
            return Optional.empty();
        }
        GitRepository connection = connections.findById(job.getRepositoryId()).orElse(null);
        if (connection == null || connection.getStatus() != GitRepositoryStatus.ACTIVE) {
            finish(job, GitSyncJobStatus.FAILED, "REPOSITORY_NOT_ACTIVE", "The repository is no longer linked");
            return Optional.empty();
        }
        GitInstallation installation = installations.findById(connection.getInstallationRef()).orElse(null);
        if (installation == null || installation.getStatus() != GitInstallationStatus.CONNECTED) {
            finish(job, GitSyncJobStatus.FAILED, "INSTALLATION_NOT_ACTIVE", "The GitHub connection is not active");
            return Optional.empty();
        }
        job.setStatus(GitSyncJobStatus.RUNNING);
        job.setAttemptCount(job.getAttemptCount() + 1);
        job.setStartedAt(now);
        job.setFinishedAt(null);
        jobs.saveAndFlush(job); // optimistic lock: a concurrent claim fails here
        return Optional.of(new ClaimedJob(job.getId(), connection.getId(), installation.getId(),
                installation.getInstallationId(), connection.getExternalId(), job.getAttemptCount(), job.getMaxAttempts()));
    }

    /** Refreshes the repository snapshot (it may have been renamed) and completes the job. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void succeed(ClaimedJob claimed, GitHubRepository repository, Map<String, Object> stats) {
        LocalDateTime now = now();
        connections.findById(claimed.repositoryId())
                .filter(row -> row.getStatus() == GitRepositoryStatus.ACTIVE)
                .ifPresent(row -> {
                    row.setOwnerLogin(repository.ownerLogin());
                    row.setName(repository.name());
                    row.setFullName(repository.fullName());
                    row.setHtmlUrl(repository.htmlUrl());
                    row.setVisibility(repository.resolvedVisibility());
                    row.setDefaultBranch(repository.defaultBranch());
                    row.setLastSyncedAt(now);
                });
        jobs.findById(claimed.jobId()).ifPresent(job -> {
            job.setStatsJson(toJson(stats));
            finish(job, GitSyncJobStatus.SUCCEEDED, null, null);
        });
    }

    /** The installation lost access to the repository: the connection becomes UNAVAILABLE (frees the master). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void repositoryLost(ClaimedJob claimed, String errorCode, String message) {
        connectionWriter.markUnavailable(claimed.repositoryId(), errorCode);
        jobs.findById(claimed.jobId()).ifPresent(job -> finish(job, GitSyncJobStatus.FAILED, errorCode, message));
    }

    /** A permanent failure: no further attempts. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(ClaimedJob claimed, String errorCode, String message) {
        jobs.findById(claimed.jobId()).ifPresent(job -> finish(job, GitSyncJobStatus.FAILED, errorCode, message));
    }

    /** A transient failure: queue another attempt with backoff, or give up after the last one. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void retryOrFail(ClaimedJob claimed, String errorCode, String message) {
        jobs.findById(claimed.jobId()).ifPresent(job -> {
            if (job.getAttemptCount() >= job.getMaxAttempts()) {
                finish(job, GitSyncJobStatus.FAILED, errorCode, message);
                return;
            }
            Duration wait = BACKOFF.get(Math.min(job.getAttemptCount(), BACKOFF.size()) - 1);
            requeue(job, now().plus(wait), errorCode, message);
        });
    }

    /** GitHub rate limit: wait until the quota resets; the attempt is not counted. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void postpone(ClaimedJob claimed, Long retryAfterSeconds) {
        jobs.findById(claimed.jobId()).ifPresent(job -> {
            job.setAttemptCount(Math.max(0, job.getAttemptCount() - 1));
            long seconds = retryAfterSeconds == null || retryAfterSeconds <= 0 ? 60 : retryAfterSeconds;
            requeue(job, now().plusSeconds(seconds), "RATE_LIMITED", "GitHub rate limit reached");
        });
    }

    /** RUNNING jobs whose worker disappeared go back to PENDING. Returns how many. */
    @Transactional
    public int requeueStuck() {
        LocalDateTime before = now().minusMinutes(properties.getSyncStuckAfterMinutes());
        List<Long> stuck = jobs.findStuckIds(GitSyncJobStatus.RUNNING, before, PageRequest.of(0, 50));
        stuck.forEach(id -> jobs.findById(id).ifPresent(job -> requeue(job, now(), "WORKER_LOST", "The previous attempt did not finish")));
        return stuck.size();
    }

    @Transactional(readOnly = true)
    public List<Long> dueJobIds(int limit) {
        return jobs.findDueIds(GitSyncJobStatus.PENDING, now(), PageRequest.of(0, limit));
    }

    private void requeue(GitSyncJob job, LocalDateTime nextRunAt, String errorCode, String message) {
        job.setStatus(GitSyncJobStatus.PENDING);
        job.setNextRunAt(nextRunAt);
        job.setErrorCode(errorCode);
        job.setErrorMessage(truncate(message));
    }

    private void finish(GitSyncJob job, GitSyncJobStatus status, String errorCode, String message) {
        job.setStatus(status);
        job.setFinishedAt(now());
        job.setErrorCode(errorCode);
        job.setErrorMessage(truncate(message));
    }

    private String toJson(Map<String, Object> stats) {
        try {
            return json.writeValueAsString(stats);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private static String truncate(String message) {
        return message == null || message.length() <= 500 ? message : message.substring(0, 500);
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }
}
