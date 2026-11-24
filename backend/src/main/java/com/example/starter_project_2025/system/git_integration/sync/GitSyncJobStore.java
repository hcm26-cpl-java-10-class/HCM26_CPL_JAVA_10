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
import com.example.starter_project_2025.system.git_integration.ingestion.event.GitSourceChangedEvent;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitSyncJobRepository;
import com.example.starter_project_2025.system.git_integration.service.GitRepositoryConnectionWriter;
import com.example.starter_project_2025.system.git_integration.service.GitRepositoryReason;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * GI-04: every state change of a sync job, each in a short transaction of its
 * own so a worker never holds a transaction while GitHub is being called.
 * Concurrent workers are kept apart by the job's {@code @Version}.
 */
@Slf4j
@Service
public class GitSyncJobStore {
    @Autowired
    private org.springframework.context.ApplicationEventPublisher activityEvents;

    /** GI-07: the job stopped because the GitHub App was uninstalled from the repository's account. */
    public static final String INSTALLATION_DISCONNECTED = "INSTALLATION_DISCONNECTED";
    static final String INSTALLATION_DISCONNECTED_MESSAGE = "The GitHub App was uninstalled from the repository's account";

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
                             String commitCursor, LocalDateTime commitSince, String commitBranch, int pagesDone,
                             String prCursor, LocalDateTime prSince, int prPagesDone, String claimToken) {

        public ClaimedJob(Long jobId, Long repositoryId, Long installationRowId, long githubInstallationId,
                          long externalId, int attemptCount, int maxAttempts) {
            this(jobId, repositoryId, installationRowId, githubInstallationId, externalId, attemptCount, maxAttempts,
                    GitSyncPhase.METADATA, null, null, null, 0, null, null, 0, null);
        }

        /** The job after its metadata step: the commit step starts from the first page of {@code since}. */
        public ClaimedJob startingCommits(LocalDateTime since, String branch) {
            return new ClaimedJob(jobId, repositoryId, installationRowId, githubInstallationId, externalId, attemptCount,
                    maxAttempts, GitSyncPhase.COMMITS, null, since, branch, pagesDone, prCursor, prSince, prPagesDone, claimToken);
        }

        /** SY-02: the job after its commit step: the pull request step starts from the first page. */
        public ClaimedJob startingPullRequests(LocalDateTime since) {
            return new ClaimedJob(jobId, repositoryId, installationRowId, githubInstallationId, externalId, attemptCount,
                    maxAttempts, GitSyncPhase.PULL_REQUESTS, commitCursor, commitSince, commitBranch, pagesDone,
                    null, since, prPagesDone, claimToken);
        }
    }

    /** SY-02: totals of one stored pull request page. */
    public record PullRequestPage(String endCursor, int inserted, int updated, int unchanged, int enriched,
                                  int reviewsInserted, int reviewsUpdated, boolean empty,
                                  GitHubCommitHistoryPage.RateLimit rateLimit) {
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
        GitRepository connection = connections.lockById(job.getRepositoryId()).orElse(null);
        if (connection != null && job.getCreatedAt() != null && connection.getLinkedAt() != null
                && job.getCreatedAt().isBefore(connection.getLinkedAt())) {
            finish(job, GitSyncJobStatus.FAILED, "REPOSITORY_RELINKED", "This job belongs to a previous repository connection");
            return Optional.empty();
        }
        if (connection == null || !connection.getStatus().receivesEvents()) {
            // GI-05: ERROR still synchronizes (a success clears it); INACTIVE / DISCONNECTED do not.
            finishStopped(job, connection);
            return Optional.empty();
        }
        GitInstallation installation = installations.findById(connection.getInstallationRef()).orElse(null);
        if (installation != null && installation.getStatus() == GitInstallationStatus.DISCONNECTED) {
            finish(job, GitSyncJobStatus.FAILED, INSTALLATION_DISCONNECTED, INSTALLATION_DISCONNECTED_MESSAGE); // GI-07
            return Optional.empty();
        }
        if (installation == null || installation.getStatus() != GitInstallationStatus.CONNECTED) {
            boolean error = installation != null && installation.getStatus() == GitInstallationStatus.ERROR;
            finish(job, GitSyncJobStatus.FAILED, error ? "INSTALLATION_ERROR" : "INSTALLATION_NOT_ACTIVE",
                    error ? "GitHub refused the connection; check the GitHub connection" : "The GitHub connection is not active");
            return Optional.empty();
        }
        job.startAttempt(now);
        jobs.saveAndFlush(job); // optimistic lock: a concurrent claim fails here
        activityEvents.publishEvent(new GitSourceChangedEvent(job.getRepositoryId()));
        return Optional.of(new ClaimedJob(job.getId(), connection.getId(), installation.getId(),
                installation.getInstallationId(), connection.getExternalId(), job.getAttemptCount(), job.getMaxAttempts(),
                job.effectivePhase(), job.getCommitCursor(), job.getCommitSince(), job.getCommitBranch(), job.pages(),
                job.getPrCursor(), job.getPrSince(), job.prPages(), job.getClaimToken()));
    }

    /**
     * SY-01: the metadata step is done: refreshes the repository snapshot (it may have been renamed),
     * records the statistics and fixes the commit window. INITIAL, or a repository whose history was
     * never imported to the end, reads the whole history; otherwise from the overlap before the last
     * complete import. Returns the job ready for its commit step.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ClaimedJob startCommits(ClaimedJob claimed, GitHubRepository repository, Map<String, Object> stats) {
        currentJob(claimed).orElseThrow(SupersededSync::new);
        GitRepository connection = connections.findById(claimed.repositoryId()).orElse(null);
        if (connection != null && connection.getStatus().receivesEvents()) refreshSnapshot(connection, repository);
        GitSyncJob job = currentJob(claimed).orElseThrow();
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
        currentJob(claimed).ifPresent(job -> {
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
        currentJob(claimed).ifPresent(job -> {
            job.setCommitCursor(null);
            job.setCommitHeadOid(null);
        });
    }

    /**
     * SY-01: the whole commit window was read: the history counts as imported up to the job's
     * creation (never moved back by an older job finishing late). SY-02: the job moves on to its
     * pull request step, whose window is fixed here: INITIAL, or a repository whose pull requests
     * were never read to the end, reads them all; otherwise down to the overlap before the last
     * complete read.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ClaimedJob completeCommits(ClaimedJob claimed) {
        GitSyncJob job = currentJob(claimed).orElseThrow(SupersededSync::new);
        GitRepository connection = connections.findById(claimed.repositoryId())
                .filter(row -> row.getStatus().receivesEvents())
                .orElse(null);
        LocalDateTime mark = mark(job);
        if (connection != null && (connection.getCommitHistorySyncedAt() == null || mark.isAfter(connection.getCommitHistorySyncedAt()))) {
            connection.setCommitHistorySyncedAt(mark);
        }
        LocalDateTime pullRequestsSyncedAt = connection == null ? null : connection.getPullRequestsSyncedAt();
        LocalDateTime since = job.getType() == GitSyncJobType.INITIAL || pullRequestsSyncedAt == null
                ? null : pullRequestsSyncedAt.minus(properties.getSyncReconcileOverlap());
        job.setPhase(GitSyncPhase.PULL_REQUESTS);
        job.setPrSince(since);
        job.setPrCursor(null);
        return claimed.startingPullRequests(since);
    }

    /** SY-02: a pull request page is stored (with all its reviews): remember where to resume, add up the statistics. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void checkpointPullRequests(ClaimedJob claimed, PullRequestPage page) {
        currentJob(claimed).ifPresent(job -> {
            if (page.endCursor() != null) job.setPrCursor(page.endCursor());
            job.setPrPagesDone(job.prPages() + 1);
            Map<String, Object> stats = new LinkedHashMap<>(readStats(job.getStatsJson()));
            add(stats, "pullRequestsInserted", page.inserted());
            add(stats, "pullRequestsUpdated", page.updated());
            add(stats, "pullRequestsUnchanged", page.unchanged());
            add(stats, "pullRequestsEnriched", page.enriched());
            add(stats, "reviewsInserted", page.reviewsInserted());
            add(stats, "reviewsUpdated", page.reviewsUpdated());
            stats.put("pullRequestPages", job.getPrPagesDone());
            if (page.empty()) stats.put("pullRequestsEmpty", true);
            if (page.rateLimit() != null) {
                stats.put("rateLimitRemaining", page.rateLimit().remaining());
                if (page.rateLimit().resetAt() != null) stats.put("rateLimitResetAt", page.rateLimit().resetAt().toString());
            }
            job.setStatsJson(toJson(stats));
        });
    }

    /** SY-02: GitHub refused the pull request cursor: read the window again from its first page. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void restartPullRequests(ClaimedJob claimed) {
        currentJob(claimed).ifPresent(job -> job.setPrCursor(null));
    }

    /**
     * SY-02: the pull request window was read: the job succeeds, and the pull requests count as read
     * up to the job's creation (only moves forward).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void completePullRequests(ClaimedJob claimed) {
        GitSyncJob job = currentJob(claimed).orElse(null);
        if (job == null) return;
        LocalDateTime now = now();
        LocalDateTime mark = mark(job);
        connections.findById(claimed.repositoryId())
                .filter(row -> row.getStatus().receivesEvents())
                .ifPresent(row -> {
                    if (row.getPullRequestsSyncedAt() == null || mark.isAfter(row.getPullRequestsSyncedAt())) {
                        row.setPullRequestsSyncedAt(mark);
                    }
                    row.setLastSyncedAt(now);
                    connectionWriter.recover(row.getId()); // GI-05: ERROR → ACTIVE once a sync succeeds
                });
        job.setPhase(GitSyncPhase.DONE);
        finish(job, GitSyncJobStatus.SUCCEEDED, null, null);
    }

    /** SY-01/SY-02: a complete read counts up to the job's creation, never later than what it really saw. */
    private LocalDateTime mark(GitSyncJob job) {
        return job.getCreatedAt() == null ? now() : job.getCreatedAt();
    }

    /** SY-01: this run read its share of pages: back in the queue at once, keeping the cursor; no attempt is used. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void yieldRun(ClaimedJob claimed) {
        currentJob(claimed).ifPresent(job -> {
            job.setAttemptCount(Math.max(0, job.getAttemptCount() - 1));
            job.setStatus(GitSyncJobStatus.PENDING);
            job.setNextRunAt(now());
            job.setErrorCode(null);
            job.setErrorMessage(null);
        });
    }

    /**
     * GitHub answered that the repository cannot be found. GI-05: the connection becomes ERROR (not
     * DISCONNECTED: only GitHub's own events confirm a revoked access) and stays the project's repository.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void repositoryLost(ClaimedJob claimed, String errorCode, String message) {
        if (currentJob(claimed).isEmpty()) return;
        connectionWriter.markError(claimed.repositoryId(), GitRepositoryReason.REPOSITORY_NOT_ACCESSIBLE);
        currentJob(claimed).ifPresent(job -> finish(job, GitSyncJobStatus.FAILED, errorCode, message));
    }

    /** GI-05: the connection was unlinked or disconnected while the job ran: it stops without touching the connection. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void stopped(ClaimedJob claimed) {
        GitRepository connection = connections.findById(claimed.repositoryId()).orElse(null);
        generationJob(claimed).ifPresent(job -> finishStopped(job, connection));
    }

    /**
     * GI-07: a GitHub call of a running job failed: when the installation was disconnected (or the
     * connection stopped receiving) meanwhile, the job stops for that reason instead of counting a
     * failure, and the installation is not marked ERROR. True when it stopped.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean stoppedIfDisconnected(ClaimedJob claimed) {
        if (generationJob(claimed).isEmpty()) return true;
        GitRepository connection = connections.findById(claimed.repositoryId()).orElse(null);
        boolean installationGone = installations.findById(claimed.installationRowId())
                .map(row -> row.getStatus() == GitInstallationStatus.DISCONNECTED).orElse(true);
        if (!installationGone && connection != null && connection.getStatus().receivesEvents()) return false;
        generationJob(claimed).ifPresent(job -> {
            if (installationGone) finish(job, GitSyncJobStatus.FAILED, INSTALLATION_DISCONNECTED, INSTALLATION_DISCONNECTED_MESSAGE);
            else finishStopped(job, connection);
        });
        return true;
    }

    /** A permanent failure: no further attempts (PARTIAL when commit pages were already stored). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(ClaimedJob claimed, String errorCode, String message) {
        currentJob(claimed).ifPresent(job -> giveUp(claimed, job, errorCode, message));
    }

    /** A transient failure: queue another attempt with backoff, or give up after the last one. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void retryOrFail(ClaimedJob claimed, String errorCode, String message) {
        currentJob(claimed).ifPresent(job -> {
            if (job.getAttemptCount() >= job.getMaxAttempts()) {
                giveUp(claimed, job, errorCode, message); // AC05: the cursor stays for a resume
                return;
            }
            Duration wait = BACKOFF.get(Math.min(job.getAttemptCount(), BACKOFF.size()) - 1);
            requeue(job, now().plus(wait), errorCode, message);
        });
    }

    /** GitHub rate limit: wait until the quota resets; the attempt is not counted. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void postpone(ClaimedJob claimed, Long retryAfterSeconds) {
        currentJob(claimed).ifPresent(job -> {
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
        int requeued = 0;
        for (Long id : stuck) {
            GitSyncJob job = jobs.lockById(id).orElse(null);
            if (job == null || job.getStatus() != GitSyncJobStatus.RUNNING) continue;
            LocalDateTime claimedAt = job.getLastClaimedAt() == null ? job.getStartedAt() : job.getLastClaimedAt();
            if (claimedAt == null || !claimedAt.isBefore(before)) continue;
            requeue(job, now(), "WORKER_LOST", "The previous attempt did not finish");
            requeued++;
        }
        return requeued;
    }

    @Transactional(readOnly = true)
    public List<Long> dueJobIds(int limit) {
        return jobs.findDueIds(GitSyncJobStatus.PENDING, now(), PageRequest.of(0, limit));
    }

    /**
     * The job stops for good. GI-05: unless the failure is the installation's (GI-02 shows that
     * connection banner), the repository connection becomes ERROR until a sync succeeds.
     */
    private void giveUp(ClaimedJob claimed, GitSyncJob job, String errorCode, String message) {
        finish(job, givenUp(job), errorCode, message);
        if (errorCode == null || !errorCode.startsWith("INSTALLATION_")) {
            connectionWriter.markError(claimed.repositoryId(), GitRepositoryReason.SYNC_FAILED);
        }
    }

    /** GI-05: why a job cannot run on its connection any more. */
    private void finishStopped(GitSyncJob job, GitRepository connection) {
        if (connection != null && connection.getStatus() == GitRepositoryStatus.DISCONNECTED
                && GitRepositoryReason.INSTALLATION_DELETED.equals(connection.getStatusReason())) {
            // GI-07 AC07: the GitHub App was uninstalled (from the platform or on GitHub).
            finish(job, GitSyncJobStatus.FAILED, INSTALLATION_DISCONNECTED, INSTALLATION_DISCONNECTED_MESSAGE);
        } else if (connection != null && connection.getStatus() == GitRepositoryStatus.DISCONNECTED) {
            finish(job, GitSyncJobStatus.FAILED, "REPOSITORY_DISCONNECTED", "GitHub no longer gives access to the repository");
        } else if (connection != null && connection.getStatus() == GitRepositoryStatus.INACTIVE) {
            finish(job, GitSyncJobStatus.FAILED, "REPOSITORY_UNLINKED", "The repository was unlinked from the project");
        } else {
            finish(job, GitSyncJobStatus.FAILED, "REPOSITORY_NOT_ACTIVE", "The repository is no longer linked");
        }
    }

    /** SY-01 AC05: PARTIAL once some commit or pull request pages are stored, otherwise FAILED. Never SUCCEEDED. */
    private static GitSyncJobStatus givenUp(GitSyncJob job) {
        return job.pages() + job.prPages() > 0 ? GitSyncJobStatus.PARTIAL : GitSyncJobStatus.FAILED;
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
        activityEvents.publishEvent(new GitSourceChangedEvent(job.getRepositoryId()));
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
        return LocalDateTime.now(clock).truncatedTo(java.time.temporal.ChronoUnit.MICROS);
    }

    /** Every worker write rechecks the connection generation under the same row lock as relink. */
    private Optional<GitSyncJob> generationJob(ClaimedJob claimed) {
        GitRepository connection = connections.lockById(claimed.repositoryId()).orElse(null);
        GitSyncJob job = jobs.findById(claimed.jobId()).orElse(null);
        if (connection == null || job == null || job.getStatus() != GitSyncJobStatus.RUNNING
                || !job.claimedBy(claimed.claimToken()) || job.getAttemptCount() != claimed.attemptCount()
                || !java.util.Objects.equals(connection.getInstallationRef(), claimed.installationRowId())
                || !java.util.Objects.equals(connection.getExternalId(), claimed.externalId())
                || job.getCreatedAt() != null && connection.getLinkedAt() != null
                    && job.getCreatedAt().isBefore(connection.getLinkedAt())) return Optional.empty();
        return Optional.of(job);
    }

    private Optional<GitSyncJob> currentJob(ClaimedJob claimed) {
        return generationJob(claimed).filter(job -> job.getRepository().getStatus().receivesEvents());
    }

    public static class SupersededSync extends RuntimeException {
        public SupersededSync() { super("This synchronization belongs to a previous repository connection"); }
    }
}
