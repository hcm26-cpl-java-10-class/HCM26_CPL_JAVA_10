package com.example.starter_project_2025.system.git_integration.sync;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.github.GitHubGraphQlClient;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommitHistoryPage;
import com.example.starter_project_2025.system.git_integration.ingestion.GitHubPayloadMapper;
import com.example.starter_project_2025.system.git_integration.ingestion.GitIngestionRetry;
import com.example.starter_project_2025.system.git_integration.ingestion.GitIngestionService;
import com.example.starter_project_2025.system.git_integration.ingestion.model.IncomingCommit;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * SY-01: imports the commit history of the default branch, one GraphQL page (100 commits)
 * at a time. Each page is read outside any transaction, stored in one transaction (by SHA, so
 * a page read twice adds nothing), and only then its cursor is saved: a run that stops
 * anywhere resumes at the first page not stored. A run reads at most
 * {@code sync-max-pages-per-run} pages, then yields the worker; it pauses until the reset
 * when the GraphQL quota runs low. Never reports success while GitHub has a next page.
 */
@Slf4j
@Component
public class CommitHistorySyncStep {

    /** How the commit step of one run ended. */
    public enum Outcome {
        /** The whole window was read: the job succeeded. */
        DONE,
        /** This run read its share of pages: queued again to continue. */
        YIELDED,
        /** The GraphQL quota is low: queued again after the reset. */
        PAUSED,
        /** The installation can no longer read the repository. */
        REPOSITORY_LOST
    }

    private final GitHubGraphQlClient graphql;
    private final InstallationTokenProvider tokens;
    private final GitIngestionService ingestion;
    private final GitHubPayloadMapper mapper;
    private final GitRepositoryRepository connections;
    private final GitSyncJobStore store;
    private final GitHubAppProperties properties;
    private final Clock clock;

    public CommitHistorySyncStep(GitHubGraphQlClient graphql, InstallationTokenProvider tokens, GitIngestionService ingestion,
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

    /** Runs the commit step of a claimed job; GitHub failures are thrown for the runner to classify. */
    public Outcome run(GitSyncJobStore.ClaimedJob job, String owner, String name) {
        OffsetDateTime since = job.commitSince() == null ? null : job.commitSince().atZone(clock.getZone()).toOffsetDateTime();
        String cursor = job.commitCursor();
        boolean firstPageOfWindow = cursor == null && job.pagesDone() == 0;
        int pages = 0;
        int inserted = 0;
        while (true) {
            String token = tokens.contentsToken(job.githubInstallationId()); // cached; renewed before it expires
            GitHubCommitHistoryPage page = graphql.commitHistory(token, owner, name, since, cursor, properties.getSyncCommitPageSize());
            if (!page.repositoryFound()) return Outcome.REPOSITORY_LOST;
            if (page.cursorRejected()) {
                // The branch was rewritten under the cursor: read the window again (stored SHAs are skipped).
                log.info("Commit history cursor rejected, restarting the window: jobId={}, repositoryId={}", job.jobId(), job.repositoryId());
                store.restartCommits(job);
                cursor = null;
                continue;
            }
            GitRepository repository = connections.findById(job.repositoryId())
                    .filter(row -> row.getStatus() == GitRepositoryStatus.ACTIVE)
                    .orElse(null);
            if (repository == null) return Outcome.REPOSITORY_LOST; // unlinked while running
            String branch = page.defaultBranch() != null ? page.defaultBranch() : job.commitBranch();
            List<IncomingCommit> commits = page.commits().stream().map(mapper::historyCommit).toList();
            GitIngestionService.CommitIngestResult result = GitIngestionRetry.onConflict(() ->
                    ingestion.ingestCommits(repository, "refs/heads/" + (branch == null ? "" : branch), commits,
                            GitIngestionService.IngestOrigin.syncJob(job.jobId()), true));
            boolean empty = firstPageOfWindow && pages == 0 && page.emptyRepository();
            store.checkpoint(job, new GitSyncJobStore.CommitPage(page.endCursor(), result.inserted(), result.existing(),
                    result.enriched(), empty, page.rateLimit()), page.headOid());
            pages++;
            inserted += result.inserted();
            if (page.endCursor() != null) cursor = page.endCursor();

            if (!page.hasNextPage()) {
                store.completeCommits(job);
                log.info("Commit history synchronized: jobId={}, repositoryId={}, pagesThisRun={}, insertedThisRun={}",
                        job.jobId(), job.repositoryId(), pages, inserted);
                return Outcome.DONE;
            }
            GitHubCommitHistoryPage.RateLimit limit = page.rateLimit();
            if (limit != null && limit.remaining() < properties.getSyncRateLimitReserve()) {
                long wait = limit.resetAt() == null ? 60 : Math.max(1, limit.resetAt().getEpochSecond() - Instant.now(clock).getEpochSecond());
                store.postpone(job, wait);
                log.info("Commit history paused for the GitHub rate limit: jobId={}, remaining={}, resumeInSeconds={}",
                        job.jobId(), limit.remaining(), wait);
                return Outcome.PAUSED;
            }
            if (pages >= properties.getSyncMaxPagesPerRun()) {
                store.yieldRun(job);
                log.info("Commit history run yielded: jobId={}, repositoryId={}, pagesThisRun={}, insertedThisRun={}",
                        job.jobId(), job.repositoryId(), pages, inserted);
                return Outcome.YIELDED;
            }
        }
    }
}
