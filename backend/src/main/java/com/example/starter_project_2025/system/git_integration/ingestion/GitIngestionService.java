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

    public record CommitIngestResult(int inserted, int existing) {
    }

    public record PullRequestUpsert(Long pullRequestId, boolean applied, boolean created, LocalDateTime storedUpdatedAt) {
    }

    public record ReviewUpsert(Long reviewId, boolean applied, boolean created) {
    }

    @Transactional
    public CommitIngestResult ingestCommits(GitRepository repository, String ref, List<IncomingCommit> incoming,
                                            Long webhookEventId) {
        Map<String, IncomingCommit> bySha = new LinkedHashMap<>();
        for (IncomingCommit commit : incoming) {
            if (commit.sha() != null && !commit.sha().isBlank()) bySha.putIfAbsent(commit.sha(), commit);
        }
        Set<String> existing = new HashSet<>();
        List<String> shas = new ArrayList<>(bySha.keySet());
        for (int from = 0; from < shas.size(); from += SHA_CHUNK) {
            existing.addAll(commits.findExistingShas(repository.getId(), shas.subList(from, Math.min(from + SHA_CHUNK, shas.size()))));
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
                    .ingestedEventId(webhookEventId).ingestedAt(now)
                    .build());
        }
        if (!fresh.isEmpty()) {
            commits.saveAllAndFlush(fresh);
            publisher.publishEvent(new CommitIngestedEvent(repository.getTenantId(), repository.getProjectId(),
                    repository.getId(), webhookEventId, ref, fresh.stream().map(GitCommit::getId).toList()));
        }
        return new CommitIngestResult(fresh.size(), bySha.size() - fresh.size());
    }

    @Transactional
    public PullRequestUpsert upsertPullRequest(GitRepository repository, IncomingPullRequest pr, String action,
                                               Long webhookEventId) {
        Optional<GitPullRequest> stored = pullRequests.findByRepositoryIdAndNumber(repository.getId(), pr.number());
        if (stored.isEmpty()) {
            GitPullRequest row = GitPullRequest.builder()
                    .tenantId(repository.getTenantId()).projectId(repository.getProjectId())
                    .repositoryId(repository.getId()).repoExternalId(repository.getExternalId())
                    .build(); // builder: applies BaseEntity defaults (is_active)
            apply(row, pr, action, webhookEventId);
            pullRequests.saveAndFlush(row); // a concurrent insert fails on uk_git_pr_repo_number
            publishPullRequest(row, action, true);
            return new PullRequestUpsert(row.getId(), true, true, row.getGithubUpdatedAt());
        }
        GitPullRequest row = stored.get();
        boolean older = pr.updatedAt().isBefore(row.getGithubUpdatedAt());
        boolean sameEvent = webhookEventId != null && webhookEventId.equals(row.getLastEventId());
        if (older || sameEvent) {
            return new PullRequestUpsert(row.getId(), false, false, row.getGithubUpdatedAt()); // AC05 / replay
        }
        apply(row, pr, action, webhookEventId);
        pullRequests.saveAndFlush(row); // a concurrent update fails on @Version
        publishPullRequest(row, action, false);
        return new PullRequestUpsert(row.getId(), true, false, row.getGithubUpdatedAt());
    }

    @Transactional
    public ReviewUpsert upsertReview(GitRepository repository, Long pullRequestId, IncomingReview review, String action,
                                     Long webhookEventId) {
        Optional<GitPullRequestReview> stored = reviews.findByRepositoryIdAndExternalId(repository.getId(), review.externalId());
        if (stored.isEmpty()) {
            GitPullRequestReview row = GitPullRequestReview.builder()
                    .tenantId(repository.getTenantId()).projectId(repository.getProjectId())
                    .repositoryId(repository.getId()).pullRequestId(pullRequestId).externalId(review.externalId())
                    .build();
            apply(row, review, action, webhookEventId);
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
        apply(row, review, action, webhookEventId);
        reviews.saveAndFlush(row);
        publishReview(row, action, false);
        return new ReviewUpsert(row.getId(), true, false);
    }

    private static void apply(GitPullRequest row, IncomingPullRequest pr, String action, Long webhookEventId) {
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
        row.setLastEventId(webhookEventId);
    }

    private void apply(GitPullRequestReview row, IncomingReview review, String action, Long webhookEventId) {
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
        row.setLastEventId(webhookEventId);
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
