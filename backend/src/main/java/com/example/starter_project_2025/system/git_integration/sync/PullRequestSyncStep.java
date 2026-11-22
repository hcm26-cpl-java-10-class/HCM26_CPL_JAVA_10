package com.example.starter_project_2025.system.git_integration.sync;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.github.GitHubGraphQlClient;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommitHistoryPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubPullRequestNode;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubPullRequestPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubReviewNode;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubReviewPage;
import com.example.starter_project_2025.system.git_integration.ingestion.GitHubPayloadMapper;
import com.example.starter_project_2025.system.git_integration.ingestion.GitIngestionRetry;
import com.example.starter_project_2025.system.git_integration.ingestion.GitIngestionService;
import com.example.starter_project_2025.system.git_integration.ingestion.model.IncomingPullRequest;
import com.example.starter_project_2025.system.git_integration.ingestion.model.IncomingReview;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * SY-02: imports the pull requests of the repository (open, closed, merged), most recently
 * updated first, with their submitted reviews. Incremental: stops at the first pull request
 * updated before the job's window ({@code pr_since}). A page is read outside any transaction,
 * including the further review pages of pull requests with many reviews; each pull request and
 * its reviews are stored by their keys (only a strictly newer pull request overwrites, see
 * {@link GitIngestionService.UpsertMode#SYNC}); the cursor is saved only once the whole page is
 * stored, so a resumed job never leaves a pull request without its reviews.
 */
@Slf4j
@Component
public class PullRequestSyncStep {

    static final String ACTION = "synchronized";

    private final GitHubGraphQlClient graphql;
    private final InstallationTokenProvider tokens;
    private final GitIngestionService ingestion;
    private final GitHubPayloadMapper mapper;
    private final GitRepositoryRepository connections;
    private final GitSyncJobStore store;
    private final GitHubAppProperties properties;
    private final Clock clock;

    public PullRequestSyncStep(GitHubGraphQlClient graphql, InstallationTokenProvider tokens, GitIngestionService ingestion,
                               GitHubPayloadMapper mapper, GitRepositoryRepository connections, GitSyncJobStore store,
                               GitHubAppProperties properties, @Qualifier("gitIntegrationClock") Clock clock) {
        this.graphql = graphql;
        this.tokens = tokens;
        this.ingestion = ingestion;
        this.mapper = mapper;
        this.connections = connections;
        this.store = store;
        this.properties = properties;
        this.clock = clock;
    }

    /** Runs the pull request step with at most {@code budget} pages; GitHub failures are thrown for the runner. */
    public SyncStepResult run(GitSyncJobStore.ClaimedJob job, String owner, String name, int budget) {
        String cursor = job.prCursor();
        boolean firstPage = cursor == null && job.prPagesDone() == 0;
        int pages = 0;
        int stored = 0;
        while (true) {
            String token = tokens.contentsToken(job.githubInstallationId());
            GitHubPullRequestPage page = graphql.pullRequests(token, owner, name, cursor,
                    properties.getSyncPullRequestPageSize(), properties.getSyncReviewPageSize());
            if (!page.repositoryFound()) return SyncStepResult.of(SyncStepResult.Outcome.REPOSITORY_LOST, job, pages);
            if (page.cursorRejected()) {
                log.info("Pull request cursor rejected, restarting the window: jobId={}, repositoryId={}", job.jobId(), job.repositoryId());
                store.restartPullRequests(job);
                cursor = null;
                continue;
            }
            GitRepository repository = connections.findById(job.repositoryId())
                    .filter(row -> row.getStatus().receivesEvents())
                    .orElse(null);
            if (repository == null) return SyncStepResult.of(SyncStepResult.Outcome.REPOSITORY_STOPPED, job, pages); // unlinked while running

            Totals totals = new Totals();
            boolean reachedWindowEnd = false;
            for (GitHubPullRequestNode node : page.pullRequests()) {
                IncomingPullRequest pr = mapper.historyPullRequest(node);
                if (job.prSince() != null && pr.updatedAt().isBefore(job.prSince())) {
                    reachedWindowEnd = true; // the list is ordered by updatedAt: everything after is older still
                    break;
                }
                List<IncomingReview> reviews = reviews(token, node, pr.updatedAt());
                store(repository, job, pr, reviews, totals);
            }
            boolean empty = firstPage && pages == 0 && page.pullRequests().isEmpty();
            store.checkpointPullRequests(job, new GitSyncJobStore.PullRequestPage(page.endCursor(), totals.inserted,
                    totals.updated, totals.unchanged, totals.enriched, totals.reviewsInserted, totals.reviewsUpdated,
                    empty, page.rateLimit()));
            pages++;
            stored += totals.inserted + totals.updated;
            if (page.endCursor() != null) cursor = page.endCursor();

            if (reachedWindowEnd || !page.hasNextPage()) {
                store.completePullRequests(job);
                log.info("Pull requests synchronized: jobId={}, repositoryId={}, pagesThisRun={}, storedThisRun={}",
                        job.jobId(), job.repositoryId(), pages, stored);
                return SyncStepResult.of(SyncStepResult.Outcome.DONE, job, pages);
            }
            GitHubCommitHistoryPage.RateLimit limit = page.rateLimit();
            if (limit != null && limit.remaining() < properties.getSyncRateLimitReserve()) {
                long wait = limit.resetAt() == null ? 60 : Math.max(1, limit.resetAt().getEpochSecond() - Instant.now(clock).getEpochSecond());
                store.postpone(job, wait);
                log.info("Pull requests paused for the GitHub rate limit: jobId={}, remaining={}, resumeInSeconds={}",
                        job.jobId(), limit.remaining(), wait);
                return SyncStepResult.of(SyncStepResult.Outcome.PAUSED, job, pages);
            }
            if (pages >= budget) {
                store.yieldRun(job);
                return SyncStepResult.of(SyncStepResult.Outcome.YIELDED, job, pages);
            }
        }
    }

    /** All submitted reviews of a pull request: the first page came with it, the rest is read here (D10). */
    private List<IncomingReview> reviews(String token, GitHubPullRequestNode node, LocalDateTime version) {
        List<GitHubReviewNode> all = new ArrayList<>(node.reviews());
        boolean more = node.reviewsHasNextPage();
        String after = node.reviewsEndCursor();
        while (more && node.nodeId() != null) {
            GitHubReviewPage page = graphql.pullRequestReviews(token, node.nodeId(), after, 100);
            all.addAll(page.reviews());
            more = page.hasNextPage() && page.endCursor() != null;
            after = page.endCursor();
        }
        List<IncomingReview> reviews = new ArrayList<>();
        for (GitHubReviewNode review : all) {
            Optional<IncomingReview> mapped = mapper.historyReview(review, version);
            mapped.ifPresent(reviews::add);
        }
        return reviews;
    }

    private void store(GitRepository repository, GitSyncJobStore.ClaimedJob job, IncomingPullRequest pr,
                       List<IncomingReview> reviews, Totals totals) {
        GitIngestionService.IngestOrigin origin = GitIngestionService.IngestOrigin.syncJob(job.jobId());
        GitIngestionService.PullRequestUpsert result = GitIngestionRetry.onConflict(() ->
                ingestion.upsertPullRequest(repository, pr, ACTION, origin, GitIngestionService.UpsertMode.SYNC));
        if (result.created()) totals.inserted++;
        else if (result.applied()) totals.updated++;
        else totals.unchanged++;
        if (result.enriched()) totals.enriched++;
        // Reviews are stored even when the pull request did not change (a review webhook may have been missed).
        for (IncomingReview review : reviews) {
            GitIngestionService.ReviewUpsert upsert = GitIngestionRetry.onConflict(() ->
                    ingestion.upsertReview(repository, result.pullRequestId(), review, ACTION, origin));
            if (upsert.created()) totals.reviewsInserted++;
            else if (upsert.applied()) totals.reviewsUpdated++;
        }
    }

    private static final class Totals {
        int inserted;
        int updated;
        int unchanged;
        int enriched;
        int reviewsInserted;
        int reviewsUpdated;
    }
}
