package com.example.starter_project_2025.system.git_integration.ingestion;

import com.example.starter_project_2025.system.git_integration.domain.GitCommit;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequest;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestReview;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitReviewState;
import com.example.starter_project_2025.system.git_integration.ingestion.event.CommitIngestedEvent;
import com.example.starter_project_2025.system.git_integration.ingestion.event.PullRequestIngestedEvent;
import com.example.starter_project_2025.system.git_integration.ingestion.event.ReviewIngestedEvent;
import com.example.starter_project_2025.system.git_integration.ingestion.model.IncomingCommit;
import com.example.starter_project_2025.system.git_integration.ingestion.model.IncomingPullRequest;
import com.example.starter_project_2025.system.git_integration.ingestion.model.IncomingReview;
import com.example.starter_project_2025.system.git_integration.repository.GitCommitRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestReviewRepository;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookJson;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * SY-04: the only writer of {@code git_commits}, {@code git_pull_requests} and
 * {@code git_pull_request_reviews}. Every method is one transaction and is
 * idempotent, so an event processed again (retry, lost worker, manual replay)
 * never duplicates data:
 * <ul>
 *   <li>commits are immutable: a SHA already stored for the connection is skipped;</li>
 *   <li>a pull request is only overwritten by data whose {@code updated_at} is not
 *       older than the stored one (AC05);</li>
 *   <li>a review is only overwritten by a strictly newer (source time, action rank).</li>
 * </ul>
 * Concurrent writers of one row are detected by the unique keys and {@code @Version};
 * callers retry through {@link GitIngestionRetry}. Domain events for Analytics are
 * published only when data really changed, inside the transaction (listeners use
 * AFTER_COMMIT).
 */
@Service
public class GitIngestionService {

    private static final int SHA_CHUNK = 500;

    private final GitCommitRepository commits;
    private final GitPullRequestRepository pullRequests;
    private final GitPullRequestReviewRepository reviews;
    private final ApplicationEventPublisher publisher;
    private final Clock clock;

    public GitIngestionService(GitCommitRepository commits, GitPullRequestRepository pullRequests,
                               GitPullRequestReviewRepository reviews, ApplicationEventPublisher publisher,
                               @Qualifier("gitIntegrationClock") Clock clock) {
        this.commits = commits;
        this.pullRequests = pullRequests;
        this.reviews = reviews;
        this.publisher = publisher;
        this.clock = clock;
    }

    /** @param enriched existing commits whose missing columns were filled (SY-01 sync only) */
    public record CommitIngestResult(int inserted, int existing, int enriched) {
        public CommitIngestResult(int inserted, int existing) {
            this(inserted, existing, 0);
        }
    }

    /** SY-01: what brought the commits: exactly one of the two is set. */
    public record IngestOrigin(Long webhookEventId, Long syncJobId) {
        public static IngestOrigin webhook(Long eventId) {
            return new IngestOrigin(eventId, null);
        }

        public static IngestOrigin syncJob(Long jobId) {
            return new IngestOrigin(null, jobId);
        }
    }

    /** @param enriched SY-02 sync: same version, only columns still NULL were filled (no event) */
    public record PullRequestUpsert(Long pullRequestId, boolean applied, boolean created, LocalDateTime storedUpdatedAt,
                                    boolean enriched) {
        public PullRequestUpsert(Long pullRequestId, boolean applied, boolean created, LocalDateTime storedUpdatedAt) {
            this(pullRequestId, applied, created, storedUpdatedAt, false);
        }
    }

    /**
     * SY-02: how a pull request version is compared with the stored one. WEBHOOK overwrites unless
     * older (several actions share one {@code updated_at}); SYNC overwrites only a strictly newer
     * version, fills the missing columns of the same version and publishes nothing for it.
     */
    public enum UpsertMode { WEBHOOK, SYNC }

    public record ReviewUpsert(Long reviewId, boolean applied, boolean created) {
    }

    @Transactional
    public CommitIngestResult ingestCommits(GitRepository repository, String ref, List<IncomingCommit> incoming,
                                            Long webhookEventId) {
        return ingestCommits(repository, ref, incoming, IngestOrigin.webhook(webhookEventId), false);
    }

    /**
     * Stores the commits not stored yet (one row per SHA). With {@code enrichExisting} (SY-01 sync),
     * a commit already stored only gets the columns still NULL filled (data a push payload lacks:
     * GitHub id, parents); nothing is overwritten, {@code first_seen_ref} never changes and no event
     * is published for it, so statistics do not grow (AC04).
     */
    @Transactional
    public CommitIngestResult ingestCommits(GitRepository repository, String ref, List<IncomingCommit> incoming,
                                            IngestOrigin origin, boolean enrichExisting) {
        Long webhookEventId = origin.webhookEventId();
        Map<String, IncomingCommit> bySha = new LinkedHashMap<>();
        for (IncomingCommit commit : incoming) {
            if (commit.sha() != null && !commit.sha().isBlank()) bySha.putIfAbsent(commit.sha(), commit);
        }
        Set<String> existing = new HashSet<>();
        List<String> shas = new ArrayList<>(bySha.keySet());
        int enriched = 0;
        for (int from = 0; from < shas.size(); from += SHA_CHUNK) {
            List<String> chunk = shas.subList(from, Math.min(from + SHA_CHUNK, shas.size()));
            if (!enrichExisting) {
                existing.addAll(commits.findExistingShas(repository.getId(), chunk));
                continue;
            }
            List<GitCommit> changed = new ArrayList<>();
            for (GitCommit stored : commits.findByRepositoryIdAndShaIn(repository.getId(), chunk)) {
                existing.add(stored.getSha());
                if (fillMissing(stored, bySha.get(stored.getSha()))) changed.add(stored);
            }
            if (!changed.isEmpty()) {
                commits.saveAllAndFlush(changed); // a concurrent writer fails on @Version: the caller retries
                enriched += changed.size();
            }
        }
        LocalDateTime now = LocalDateTime.now(clock);
        String firstSeenRef = GitWebhookJson.limit(ref, 255);
        List<GitCommit> fresh = new ArrayList<>();
        for (IncomingCommit c : bySha.values()) {
            if (existing.contains(c.sha())) continue;
            fresh.add(GitCommit.builder()
                    .tenantId(repository.getTenantId()).projectId(repository.getProjectId())
                    .repositoryId(repository.getId()).repoExternalId(repository.getExternalId())
                    .sha(c.sha()).message(c.message())
                    .authorName(c.authorName()).authorEmail(c.authorEmail())
                    .authorLogin(c.authorLogin()).authorGithubId(c.authorGithubId())
                    .committerName(c.committerName()).committerEmail(c.committerEmail()).committerLogin(c.committerLogin())
                    .authoredAt(c.authoredAt()).committedAt(c.committedAt())
                    .htmlUrl(c.htmlUrl()).firstSeenRef(firstSeenRef == null ? "" : firstSeenRef)
                    .filesChanged(c.filesChanged()).parentCount(c.parentCount()).source(c.source())
                    .mergeCommit(isMerge(c.parentCount())).bot(isBot(c.authorLogin(), c.committerLogin()))
                    .ingestedEventId(webhookEventId).ingestedSyncJobId(origin.syncJobId()).ingestedAt(now)
                    .build());
        }
        if (!fresh.isEmpty()) {
            commits.saveAllAndFlush(fresh);
            publisher.publishEvent(new CommitIngestedEvent(repository.getTenantId(), repository.getProjectId(),
                    repository.getId(), webhookEventId, ref, fresh.stream().map(GitCommit::getId).toList(),
                    origin.syncJobId()));
        }
        return new CommitIngestResult(fresh.size(), bySha.size() - fresh.size(), enriched);
    }

    /** SY-01: two parents or more; NULL while the parents are unknown (push payloads). */
    static Boolean isMerge(Integer parentCount) {
        return parentCount == null ? null : parentCount >= 2;
    }

    /** SY-01: the GitHub author login (else the committer's) ends with {@code [bot]}. */
    static boolean isBot(String authorLogin, String committerLogin) {
        String login = authorLogin != null ? authorLogin : committerLogin;
        return login != null && login.toLowerCase(java.util.Locale.ROOT).endsWith("[bot]");
    }

    /** Fills the columns of a stored commit that are still NULL; returns true when one was. */
    private static boolean fillMissing(GitCommit row, IncomingCommit c) {
        boolean changed = false;
        if (row.getAuthorLogin() == null && c.authorLogin() != null) { row.setAuthorLogin(c.authorLogin()); changed = true; }
        if (row.getAuthorGithubId() == null && c.authorGithubId() != null) { row.setAuthorGithubId(c.authorGithubId()); changed = true; }
        if (row.getCommitterLogin() == null && c.committerLogin() != null) { row.setCommitterLogin(c.committerLogin()); changed = true; }
        if (row.getAuthoredAt() == null && c.authoredAt() != null) { row.setAuthoredAt(c.authoredAt()); changed = true; }
        if (row.getHtmlUrl() == null && c.htmlUrl() != null) { row.setHtmlUrl(c.htmlUrl()); changed = true; }
        if (row.getParentCount() == null && c.parentCount() != null) { row.setParentCount(c.parentCount()); changed = true; }
        Boolean merge = isMerge(row.getParentCount());
        if (row.getMergeCommit() == null && merge != null) { row.setMergeCommit(merge); changed = true; }
        boolean bot = isBot(row.getAuthorLogin(), row.getCommitterLogin());
        if (row.getBot() == null || (bot && !row.getBot())) {
            if (!Boolean.valueOf(bot).equals(row.getBot())) changed = true;
            row.setBot(bot);
        }
        return changed;
    }

    @Transactional
    public PullRequestUpsert upsertPullRequest(GitRepository repository, IncomingPullRequest pr, String action,
                                               Long webhookEventId) {
        return upsertPullRequest(repository, pr, action, IngestOrigin.webhook(webhookEventId), UpsertMode.WEBHOOK);
    }

    @Transactional
    public PullRequestUpsert upsertPullRequest(GitRepository repository, IncomingPullRequest pr, String action,
                                               IngestOrigin origin, UpsertMode mode) {
        Long webhookEventId = origin.webhookEventId();
        Optional<GitPullRequest> stored = pullRequests.findByRepositoryIdAndNumber(repository.getId(), pr.number());
        if (stored.isEmpty()) {
            GitPullRequest row = GitPullRequest.builder()
                    .tenantId(repository.getTenantId()).projectId(repository.getProjectId())
                    .repositoryId(repository.getId()).repoExternalId(repository.getExternalId())
                    .build(); // builder: applies BaseEntity defaults (is_active)
            apply(row, pr, action, origin);
            pullRequests.saveAndFlush(row); // a concurrent insert fails on uk_git_pr_repo_number
            publishPullRequest(row, action, true);
            return new PullRequestUpsert(row.getId(), true, true, row.getGithubUpdatedAt());
        }
        GitPullRequest row = stored.get();
        if (mode == UpsertMode.SYNC && !pr.updatedAt().isAfter(row.getGithubUpdatedAt())) {
            // Same version: only what a webhook payload lacked (counters of a review payload, ids).
            boolean enriched = pr.updatedAt().isEqual(row.getGithubUpdatedAt()) && fillMissing(row, pr);
            if (enriched) pullRequests.saveAndFlush(row);
            return new PullRequestUpsert(row.getId(), false, false, row.getGithubUpdatedAt(), enriched);
        }
        boolean older = pr.updatedAt().isBefore(row.getGithubUpdatedAt());
        boolean sameEvent = webhookEventId != null && webhookEventId.equals(row.getLastEventId());
        if (older || sameEvent) {
            return new PullRequestUpsert(row.getId(), false, false, row.getGithubUpdatedAt()); // AC05 / replay
        }
        apply(row, pr, action, origin);
        pullRequests.saveAndFlush(row); // a concurrent update fails on @Version
        publishPullRequest(row, action, false);
        return new PullRequestUpsert(row.getId(), true, false, row.getGithubUpdatedAt());
    }

    @Transactional
    public ReviewUpsert upsertReview(GitRepository repository, Long pullRequestId, IncomingReview review, String action,
                                     Long webhookEventId) {
        return upsertReview(repository, pullRequestId, review, action, IngestOrigin.webhook(webhookEventId));
    }

    /** The newer (source time, then action rank) version of a review wins, whatever brought it (webhook or sync). */
    @Transactional
    public ReviewUpsert upsertReview(GitRepository repository, Long pullRequestId, IncomingReview review, String action,
                                     IngestOrigin origin) {
        Optional<GitPullRequestReview> stored = reviews.findByRepositoryIdAndExternalId(repository.getId(), review.externalId());
        if (stored.isEmpty()) {
            GitPullRequestReview row = GitPullRequestReview.builder()
                    .tenantId(repository.getTenantId()).projectId(repository.getProjectId())
                    .repositoryId(repository.getId()).pullRequestId(pullRequestId).externalId(review.externalId())
                    .build();
            apply(row, review, action, origin);
            reviews.saveAndFlush(row);
            publishReview(row, action, true);
            return new ReviewUpsert(row.getId(), true, true);
        }
        GitPullRequestReview row = stored.get();
        int byTime = review.sourceUpdatedAt().compareTo(row.getSourceUpdatedAt());
        boolean newer = byTime > 0 || (byTime == 0 && review.actionRank() > row.getSourceActionRank());
        if (!newer) {
            return new ReviewUpsert(row.getId(), false, false); // AC05: older, equal or replayed
        }
        apply(row, review, action, origin);
        reviews.saveAndFlush(row);
        publishReview(row, action, false);
        return new ReviewUpsert(row.getId(), true, false);
    }

    private static void apply(GitPullRequest row, IncomingPullRequest pr, String action, IngestOrigin origin) {
        row.setExternalId(pr.externalId() == null ? Long.valueOf(pr.number()) : pr.externalId());
        row.setNumber(pr.number());
        row.setTitle(pr.title());
        row.setBody(pr.body());
        row.setState(pr.state());
        row.setDraft(pr.draft());
        row.setAuthorLogin(pr.authorLogin());
        row.setAuthorGithubId(pr.authorGithubId());
        row.setHeadRef(pr.headRef());
        row.setHeadSha(pr.headSha());
        row.setBaseRef(pr.baseRef());
        row.setMergeCommitSha(pr.mergeCommitSha());
        row.setMergedByLogin(pr.mergedByLogin());
        // Review payloads carry a pull request without these counters: keep the known values.
        if (pr.commitsCount() != null) row.setCommitsCount(pr.commitsCount());
        if (pr.additions() != null) row.setAdditions(pr.additions());
        if (pr.deletions() != null) row.setDeletions(pr.deletions());
        if (pr.changedFiles() != null) row.setChangedFiles(pr.changedFiles());
        row.setHtmlUrl(pr.htmlUrl());
        row.setGithubCreatedAt(pr.createdAt());
        row.setGithubUpdatedAt(pr.updatedAt());
        row.setClosedAt(pr.closedAt());
        row.setMergedAt(pr.mergedAt());
        row.setLastAction(GitWebhookJson.limit(action, 50));
        row.setLastEventId(origin.webhookEventId());
        row.setLastSyncJobId(origin.syncJobId());
    }

    /** SY-02: fills the columns of a stored pull request that are still NULL; returns true when one was. */
    private static boolean fillMissing(GitPullRequest row, IncomingPullRequest pr) {
        boolean changed = false;
        if (row.getCommitsCount() == null && pr.commitsCount() != null) { row.setCommitsCount(pr.commitsCount()); changed = true; }
        if (row.getAdditions() == null && pr.additions() != null) { row.setAdditions(pr.additions()); changed = true; }
        if (row.getDeletions() == null && pr.deletions() != null) { row.setDeletions(pr.deletions()); changed = true; }
        if (row.getChangedFiles() == null && pr.changedFiles() != null) { row.setChangedFiles(pr.changedFiles()); changed = true; }
        if (row.getMergeCommitSha() == null && pr.mergeCommitSha() != null) { row.setMergeCommitSha(pr.mergeCommitSha()); changed = true; }
        if (row.getMergedByLogin() == null && pr.mergedByLogin() != null) { row.setMergedByLogin(pr.mergedByLogin()); changed = true; }
        if (row.getAuthorGithubId() == null && pr.authorGithubId() != null) { row.setAuthorGithubId(pr.authorGithubId()); changed = true; }
        if (row.getHtmlUrl() == null && pr.htmlUrl() != null) { row.setHtmlUrl(pr.htmlUrl()); changed = true; }
        return changed;
    }

    private void apply(GitPullRequestReview row, IncomingReview review, String action, IngestOrigin origin) {
        row.setReviewerLogin(review.reviewerLogin());
        row.setReviewerGithubId(review.reviewerGithubId());
        row.setState(review.state());
        row.setBody(review.body());
        row.setCommitSha(review.commitSha());
        if (review.submittedAt() != null) row.setSubmittedAt(review.submittedAt());
        row.setHtmlUrl(review.htmlUrl());
        row.setSourceUpdatedAt(review.sourceUpdatedAt());
        row.setSourceActionRank(review.actionRank());
        if (review.state() == GitReviewState.DISMISSED && row.getDismissedAt() == null) {
            row.setDismissedAt(LocalDateTime.now(clock));
        }
        row.setLastAction(GitWebhookJson.limit(action, 50));
        row.setLastEventId(origin.webhookEventId());
        row.setLastSyncJobId(origin.syncJobId());
    }

    private void publishPullRequest(GitPullRequest row, String action, boolean created) {
        publisher.publishEvent(new PullRequestIngestedEvent(row.getTenantId(), row.getProjectId(), row.getRepositoryId(),
                row.getId(), row.getNumber(), action, row.getState(), created));
    }

    private void publishReview(GitPullRequestReview row, String action, boolean created) {
        publisher.publishEvent(new ReviewIngestedEvent(row.getTenantId(), row.getProjectId(), row.getRepositoryId(),
                row.getPullRequestId(), row.getId(), row.getState(), action, created));
    }
}
