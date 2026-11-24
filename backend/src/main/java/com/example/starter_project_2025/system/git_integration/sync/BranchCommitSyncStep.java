package com.example.starter_project_2025.system.git_integration.sync;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitBranch;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.GitHubGraphQlClient;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubBranchPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommitHistoryPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubComparePage;
import com.example.starter_project_2025.system.git_integration.ingestion.GitHubPayloadMapper;
import com.example.starter_project_2025.system.git_integration.ingestion.GitIngestionRetry;
import com.example.starter_project_2025.system.git_integration.ingestion.GitIngestionService;
import com.example.starter_project_2025.system.git_integration.ingestion.model.IncomingCommit;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.service.GitBranchWriter;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

/**
 * SY-07: imports the commits of the branches other than the default branch, after the commit step
 * (SY-01) imported the default branch.
 * <ol>
 *   <li>Lists the branches ({@code refs/heads/*}, 100 per GraphQL page) into {@code git_branches};
 *       after a complete listing the branches not seen are marked deleted (their commits stay).</li>
 *   <li>Reads the branches in scope whose head changed since their last import (at most
 *       {@code sync-max-branches}, latest head first, minus {@code sync-branch-exclude}).</li>
 *   <li>For each, imports only its commits that are not on the default branch
 *       ({@code default..branch}), at most {@code sync-branch-max-pages} pages, with
 *       {@code first_seen_ref = refs/heads/{branch}}; commits already stored keep their ref.</li>
 * </ol>
 * Like the commit step, a page is read outside any transaction, stored, and only then its cursor is
 * saved; a branch is marked imported together with its last page, so a resumed job goes on with the
 * branch it was reading and never reads a finished one again. A branch gone from GitHub is skipped.
 */
@Slf4j
@Component
public class BranchCommitSyncStep {

    private static final int LIST_PAGE_SIZE = 100;
    private static final String HEADS = "refs/heads/";

    private final GitHubGraphQlClient graphql;
    private final InstallationTokenProvider tokens;
    private final GitIngestionService ingestion;
    private final GitHubPayloadMapper mapper;
    private final GitRepositoryRepository connections;
    private final GitBranchWriter branches;
    private final GitSyncJobStore store;
    private final GitHubAppProperties properties;
    private final Clock clock;

    public BranchCommitSyncStep(GitHubGraphQlClient graphql, InstallationTokenProvider tokens, GitIngestionService ingestion,
                                GitHubPayloadMapper mapper, GitRepositoryRepository connections, GitBranchWriter branches,
                                GitSyncJobStore store, GitHubAppProperties properties,
                                @Qualifier("gitIntegrationClock") Clock clock) {
        this.graphql = graphql;
        this.tokens = tokens;
        this.ingestion = ingestion;
        this.mapper = mapper;
        this.connections = connections;
        this.branches = branches;
        this.store = store;
        this.properties = properties;
        this.clock = clock;
    }

    /** Runs the branch step of a claimed job with at most {@code budget} pages; GitHub failures are thrown. */
    public SyncStepResult run(GitSyncJobStore.ClaimedJob claimed, String owner, String name, int budget) {
        String defaultBranch = claimed.commitBranch();
        if (defaultBranch == null) return SyncStepResult.of(SyncStepResult.Outcome.DONE, store.completeBranches(claimed), 0);
        Run run = new Run();
        run.job = claimed;
        if (!claimed.branch().listed()) {
            SyncStepResult stopped = list(claimed, owner, name, run);
            if (stopped != null) return stopped;
        }
        final GitSyncJobStore.ClaimedJob job = run.job;

        List<GitBranch> candidates = branches.candidates(job.repositoryId(), defaultBranch);
        List<GitBranch> todo = new ArrayList<>(candidates.stream().filter(GitBranch::needsSync)
                .sorted(Comparator.comparing(GitBranch::getName)).toList());
        String current = job.branch().name();
        if (current != null) {
            // The branch a previous run was reading goes first, from its saved cursor.
            todo.stream().filter(row -> row.getName().equals(current)).findFirst().ifPresent(row -> {
                todo.remove(row);
                todo.add(0, row);
            });
        }
        store.branchPlan(job, candidates.size(), todo.size());

        int synced = 0;
        int inserted = 0;
        for (GitBranch branch : todo) {
            if (run.pages >= budget) return yieldRun(job, run, synced, inserted);
            boolean resume = branch.getName().equals(current);
            String cursor = resume ? job.branch().cursor() : null;
            int branchPages = resume ? job.branch().namePages() : 0;
            while (true) {
                String token = tokens.contentsToken(job.githubInstallationId());
                GitHubComparePage page = graphql.compare(token, owner, name, defaultBranch, branch.getName(), cursor,
                        properties.getSyncCommitPageSize());
                if (!page.repositoryFound()) return SyncStepResult.of(SyncStepResult.Outcome.REPOSITORY_LOST, job, run.pages);
                if (page.cursorRejected()) {
                    if (cursor == null) throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, "branch commits", 200);
                    log.info("Branch cursor rejected, reading the branch again: jobId={}, branch={}", job.jobId(), branch.getName());
                    cursor = null;
                    branchPages = 0;
                    continue;
                }
                if (!page.refFound()) {
                    // Deleted or renamed meanwhile: its commits already stored stay, the others are not reachable.
                    log.info("Branch gone during synchronization: jobId={}, branch={}", job.jobId(), branch.getName());
                    GitIngestionRetry.onConflict(() -> {
                        branches.markGone(job.repositoryId(), branch.getName());
                        return null;
                    });
                    store.branchSkipped(job, true);
                    break;
                }
                GitRepository repository = activeConnection(job);
                if (repository == null) return SyncStepResult.of(SyncStepResult.Outcome.REPOSITORY_STOPPED, job, run.pages);
                List<IncomingCommit> commits = page.commits().stream().map(mapper::historyCommit).toList();
                GitIngestionService.CommitIngestResult result = GitIngestionRetry.onConflict(() ->
                        ingestion.ingestCommits(repository, HEADS + branch.getName(), commits,
                                GitIngestionService.IngestOrigin.syncJob(job.jobId()), true));
                branchPages++;
                run.pages++;
                inserted += result.inserted();
                boolean last = !page.hasNextPage() || branchPages >= properties.getSyncBranchMaxPages();
                GitBranchWriter.Synced done = last
                        ? new GitBranchWriter.Synced(branch.getHeadOid(), page.aheadBy(), page.behindBy(), page.hasNextPage())
                        : null;
                store.checkpointBranch(job, new GitSyncJobStore.BranchPage(branch.getName(), page.endCursor(), branchPages,
                        result.inserted(), result.existing(), result.enriched(), page.rateLimit()), done);
                if (page.endCursor() != null) cursor = page.endCursor();
                if (last) {
                    synced++;
                    if (page.hasNextPage()) {
                        log.info("Branch import stopped at the page cap: jobId={}, branch={}, pages={}",
                                job.jobId(), branch.getName(), branchPages);
                    }
                }
                SyncStepResult paused = pauseIfLow(job, page.rateLimit(), run);
                if (paused != null) return paused;
                if (last) break;
                if (run.pages >= budget) return yieldRun(job, run, synced, inserted);
            }
        }

        GitSyncJobStore.ClaimedJob next = store.completeBranches(job);
        log.info("Branches synchronized: jobId={}, repositoryId={}, branchesThisRun={}, insertedThisRun={}, pagesThisRun={}",
                job.jobId(), job.repositoryId(), synced, inserted, run.pages);
        return SyncStepResult.of(SyncStepResult.Outcome.DONE, next, run.pages);
    }

    /** Lists every branch page (restarting from the first one); null once done, else how the run ended. */
    private SyncStepResult list(GitSyncJobStore.ClaimedJob job, String owner, String name, Run run) {
        String cursor = null;
        int listPages = 0;
        boolean restarted = false;
        while (true) {
            String token = tokens.contentsToken(job.githubInstallationId());
            GitHubBranchPage page = graphql.branches(token, owner, name, cursor, LIST_PAGE_SIZE);
            if (!page.repositoryFound()) return SyncStepResult.of(SyncStepResult.Outcome.REPOSITORY_LOST, job, run.pages);
            if (page.cursorRejected()) {
                if (restarted || cursor == null) throw new GitHubApiException(GitHubApiException.Kind.UNAVAILABLE, "branches", 200);
                restarted = true;
                cursor = null;
                listPages = 0;
                continue;
            }
            GitRepository repository = activeConnection(job);
            if (repository == null) return SyncStepResult.of(SyncStepResult.Outcome.REPOSITORY_STOPPED, job, run.pages);
            GitIngestionRetry.onConflict(() -> {
                branches.upsertListed(repository, job.jobId(), page.defaultBranch(), page.branches());
                return null;
            });
            store.checkpointBranchList(job, page.branches().size(), page.rateLimit());
            listPages++;
            run.pages++;
            if (page.endCursor() != null) cursor = page.endCursor();
            boolean complete = !page.hasNextPage();
            if (complete || listPages >= properties.getSyncMaxBranchPages()) {
                // Only a complete listing proves that a branch it did not see is gone.
                int deleted = complete ? branches.markUnseenDeleted(job.repositoryId(), job.jobId()) : 0;
                run.job = store.branchListDone(job, !complete, deleted);
                return null;
            }
            SyncStepResult paused = pauseIfLow(job, page.rateLimit(), run);
            if (paused != null) return paused;
        }
    }

    private SyncStepResult pauseIfLow(GitSyncJobStore.ClaimedJob job, GitHubCommitHistoryPage.RateLimit limit, Run run) {
        if (limit == null || limit.remaining() >= properties.getSyncRateLimitReserve()) return null;
        long wait = limit.resetAt() == null ? 60 : Math.max(1, limit.resetAt().getEpochSecond() - Instant.now(clock).getEpochSecond());
        store.postpone(job, wait);
        log.info("Branch import paused for the GitHub rate limit: jobId={}, remaining={}, resumeInSeconds={}",
                job.jobId(), limit.remaining(), wait);
        return SyncStepResult.of(SyncStepResult.Outcome.PAUSED, job, run.pages);
    }

    private SyncStepResult yieldRun(GitSyncJobStore.ClaimedJob job, Run run, int synced, int inserted) {
        store.yieldRun(job);
        log.info("Branch import run yielded: jobId={}, repositoryId={}, branchesThisRun={}, insertedThisRun={}",
                job.jobId(), job.repositoryId(), synced, inserted);
        return SyncStepResult.of(SyncStepResult.Outcome.YIELDED, job, run.pages);
    }

    private GitRepository activeConnection(GitSyncJobStore.ClaimedJob job) {
        return connections.findById(job.repositoryId())
                .filter(row -> row.getStatus().receivesEvents())
                .orElse(null);
    }

    /** Pages used by this run, and the job as the listing left it. */
    private static final class Run {
        int pages;
        GitSyncJobStore.ClaimedJob job;

    }
}
