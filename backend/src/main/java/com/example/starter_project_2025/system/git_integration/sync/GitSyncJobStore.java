package com.example.starter_project_2025.system.git_integration.sync;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJob;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncPhase;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommitHistoryPage;
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
import java.util.LinkedHashMap;
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

    /**
     * What a worker needs to run a job it has claimed. SY-01: the step reached and, in the commit
     * step, where to resume ({@code commitCursor}) within which window ({@code commitSince}).
     */
    public record ClaimedJob(Long jobId, Long repositoryId, Long installationRowId, long githubInstallationId,
                             long externalId, int attemptCount, int maxAttempts, GitSyncPhase phase,
                             String commitCursor, LocalDateTime commitSince, String commitBranch, int pagesDone) {

        public ClaimedJob(Long jobId, Long repositoryId, Long installationRowId, long githubInstallationId,
                          long externalId, int attemptCount, int maxAttempts) {
            this(jobId, repositoryId, installationRowId, githubInstallationId, externalId, attemptCount, maxAttempts,
                    GitSyncPhase.METADATA, null, null, null, 0);
        }

        /** The job after its metadata step: the commit step starts from the first page of {@code since}. */
        public ClaimedJob startingCommits(LocalDateTime since, String branch) {
            return new ClaimedJob(jobId, repositoryId, installationRowId, githubInstallationId, externalId, attemptCount,
                    maxAttempts, GitSyncPhase.COMMITS, null, since, branch, pagesDone);
        }
    }

    /** SY-01: totals of one stored commit page. */
    public record CommitPage(String endCursor, int inserted, int existing, int enriched, boolean emptyRepository,
                             GitHubCommitHistoryPage.RateLimit rateLimit) {
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
                installation.getInstallationId(), connection.getExternalId(), job.getAttemptCount(), job.getMaxAttempts(),
                job.effectivePhase(), job.getCommitCursor(), job.getCommitSince(), job.getCommitBranch(), job.pages()));
    }

    /**
     * SY-01: the metadata step is done: refreshes the repository snapshot (it may have been renamed),
     * records the statistics and fixes the commit window. INITIAL, or a repository whose history was
     * never imported to the end, reads the whole history; otherwise from the overlap before the last
     * complete import. Returns the job ready for its commit step.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ClaimedJob startCommits(ClaimedJob claimed, GitHubRepository repository, Map<String, Object> stats) {
        GitRepository connection = connections.findById(claimed.repositoryId()).orElse(null);
        if (connection != null && connection.getStatus() == GitRepositoryStatus.ACTIVE) refreshSnapshot(connection, repository);
        GitSyncJob job = jobs.findById(claimed.jobId()).orElseThrow();
        LocalDateTime historySyncedAt = connection == null ? null : connection.getCommitHistorySyncedAt();
        LocalDateTime since = job.getType() == GitSyncJobType.INITIAL || historySyncedAt == null
                ? null : historySyncedAt.minus(properties.getSyncReconcileOverlap());
        job.setStatsJson(toJson(stats));
        job.setPhase(GitSyncPhase.COMMITS);
        job.setCommitSince(since);
        job.setCommitBranch(repository.defaultBranch());
        job.setCommitCursor(null);
        return claimed.startingCommits(since, repository.defaultBranch());
    }

    /** SY-01: a commit page is stored: remember where to resume and add up the statistics. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void checkpoint(ClaimedJob claimed, CommitPage page, String headOid) {
        jobs.findById(claimed.jobId()).ifPresent(job -> {
            if (page.endCursor() != null) job.setCommitCursor(page.endCursor());
            if (headOid != null && job.getCommitHeadOid() == null) job.setCommitHeadOid(headOid);
            job.setPagesDone(job.pages() + 1);
            Map<String, Object> stats = new LinkedHashMap<>(readStats(job.getStatsJson()));
            add(stats, "commitsInserted", page.inserted());
            add(stats, "commitsExisting", page.existing());
            add(stats, "commitsEnriched", page.enriched());
            stats.put("commitPages", job.getPagesDone());
            if (page.emptyRepository()) stats.put("emptyRepository", true);
            if (page.rateLimit() != null) {
                stats.put("rateLimitRemaining", page.rateLimit().remaining());
                if (page.rateLimit().resetAt() != null) stats.put("rateLimitResetAt", page.rateLimit().resetAt().toString());
            }
            job.setStatsJson(toJson(stats));
        });
    }

    /** SY-01: GitHub refused the cursor (history rewritten): read the window again from its first page. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void restartCommits(ClaimedJob claimed) {
        jobs.findById(claimed.jobId()).ifPresent(job -> {
            job.setCommitCursor(null);
            job.setCommitHeadOid(null);
        });
    }

    /**
     * SY-01: the whole commit window was read: the job succeeds, and the history counts as
     * imported up to the job's creation (never moved back by an older job finishing late).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void completeCommits(ClaimedJob claimed) {
        GitSyncJob job = jobs.findById(claimed.jobId()).orElse(null);
        if (job == null) return;
        LocalDateTime now = now();
        connections.findById(claimed.repositoryId())
                .filter(row -> row.getStatus() == GitRepositoryStatus.ACTIVE)
                .ifPresent(row -> {
                    LocalDateTime mark = job.getCreatedAt() == null ? now : job.getCreatedAt();
                    if (row.getCommitHistorySyncedAt() == null || mark.isAfter(row.getCommitHistorySyncedAt())) {
                        row.setCommitHistorySyncedAt(mark);
                    }
                    row.setLastSyncedAt(now);
                });
        job.setPhase(GitSyncPhase.DONE);
        finish(job, GitSyncJobStatus.SUCCEEDED, null, null);
    }

    /** SY-01: this run read its share of pages: back in the queue at once, keeping the cursor; no attempt is used. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void yieldRun(ClaimedJob claimed) {
        jobs.findById(claimed.jobId()).ifPresent(job -> {
            job.setAttemptCount(Math.max(0, job.getAttemptCount() - 1));
            job.setStatus(GitSyncJobStatus.PENDING);
            job.setNextRunAt(now());
            job.setErrorCode(null);
            job.setErrorMessage(null);
        });
    }

    /** The installation lost access to the repository: the connection becomes UNAVAILABLE (frees the master). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void repositoryLost(ClaimedJob claimed, String errorCode, String message) {
        connectionWriter.markUnavailable(claimed.repositoryId(), errorCode);
        jobs.findById(claimed.jobId()).ifPresent(job -> finish(job, GitSyncJobStatus.FAILED, errorCode, message));
    }

    /** A permanent failure: no further attempts (PARTIAL when commit pages were already stored). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(ClaimedJob claimed, String errorCode, String message) {
        jobs.findById(claimed.jobId()).ifPresent(job -> finish(job, givenUp(job), errorCode, message));
    }

    /** A transient failure: queue another attempt with backoff, or give up after the last one. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void retryOrFail(ClaimedJob claimed, String errorCode, String message) {
        jobs.findById(claimed.jobId()).ifPresent(job -> {
            if (job.getAttemptCount() >= job.getMaxAttempts()) {
                finish(job, givenUp(job), errorCode, message); // AC05: the cursor stays for a resume
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

    /** SY-01 AC05: PARTIAL once some commit pages are stored, otherwise FAILED. Never SUCCEEDED. */
    private static GitSyncJobStatus givenUp(GitSyncJob job) {
        return job.pages() > 0 ? GitSyncJobStatus.PARTIAL : GitSyncJobStatus.FAILED;
    }

    private static void refreshSnapshot(GitRepository row, GitHubRepository repository) {
        row.setOwnerLogin(repository.ownerLogin());
        row.setName(repository.name());
        row.setFullName(repository.fullName());
        row.setHtmlUrl(repository.htmlUrl());
        row.setVisibility(repository.resolvedVisibility());
        row.setDefaultBranch(repository.defaultBranch());
    }

    private static void add(Map<String, Object> stats, String key, int value) {
        Object current = stats.get(key);
        long base = current instanceof Number number ? number.longValue() : 0;
        stats.put(key, base + value);
    }

    private Map<String, Object> readStats(String statsJson) {
        if (statsJson == null || statsJson.isBlank()) return Map.of();
        try {
            return json.readValue(statsJson, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() { });
        } catch (JsonProcessingException e) {
            return Map.of();
        }
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
