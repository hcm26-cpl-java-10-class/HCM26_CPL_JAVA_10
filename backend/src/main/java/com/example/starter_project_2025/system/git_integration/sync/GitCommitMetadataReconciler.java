package com.example.starter_project_2025.system.git_integration.sync;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.config.GitWebhookAsyncConfig;
import com.example.starter_project_2025.system.git_integration.domain.GitCommit;
import com.example.starter_project_2025.system.git_integration.domain.GitCommitSource;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.ingestion.GitHubPayloadMapper;
import com.example.starter_project_2025.system.git_integration.ingestion.GitIngestionRetry;
import com.example.starter_project_2025.system.git_integration.ingestion.GitIngestionService;
import com.example.starter_project_2025.system.git_integration.ingestion.event.CommitIngestedEvent;
import com.example.starter_project_2025.system.git_integration.repository.GitCommitRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/** Fills immutable metadata omitted by push payloads, including commits outside the default branch. */
@Slf4j
@Component
@ConditionalOnProperty(name = "app.github.commit-metadata-reconcile-enabled", havingValue = "true", matchIfMissing = true)
public class GitCommitMetadataReconciler {
    static final int BATCH_SIZE = 50;
    private final GitHubAppProperties properties;
    private final GitCommitRepository commits;
    private final GitHubApiClient github;
    private final InstallationTokenProvider tokens;
    private final GitHubPayloadMapper mapper;
    private final GitIngestionService ingestion;
    private final Clock clock;
    private volatile Instant retryAfter = Instant.MIN;
    private long cursor;

    public GitCommitMetadataReconciler(GitHubAppProperties properties, GitCommitRepository commits,
            GitHubApiClient github, InstallationTokenProvider tokens, GitHubPayloadMapper mapper,
            GitIngestionService ingestion, @Qualifier("gitIntegrationClock") Clock clock) {
        this.properties = properties;
        this.commits = commits;
        this.github = github;
        this.tokens = tokens;
        this.mapper = mapper;
        this.ingestion = ingestion;
        this.clock = clock;
    }

    @Async(GitWebhookAsyncConfig.WEBHOOK_EXECUTOR)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void afterIngestion(CommitIngestedEvent event) {
        if (!available() || event.commitIds().isEmpty()) return;
        enrich(commits.findMissingMetadataByIds(event.commitIds(), PageRequest.of(0, BATCH_SIZE)));
    }

    /** Also repairs old rows and work lost when the bounded async queue or application stops. */
    @Scheduled(fixedDelayString = "${app.github.commit-metadata-reconcile-delay-ms:30000}",
            initialDelayString = "${app.github.commit-metadata-reconcile-delay-ms:30000}")
    @SchedulerLock(name = "git-commit-metadata", lockAtMostFor = "PT5M")
    public void scheduled() {
        if (!available()) return;
        List<GitCommit> batch = commits.findMissingMetadata(cursor, PageRequest.of(0, BATCH_SIZE));
        cursor = batch.size() < BATCH_SIZE ? 0 : batch.getLast().getId();
        enrich(batch);
    }

    private boolean available() {
        return properties.isEnabled() && !clock.instant().isBefore(retryAfter);
    }

    private void enrich(List<GitCommit> batch) {
        for (GitCommit commit : batch) {
            if (!available()) return;
            var repository = commit.getRepository();
            try {
                String token = tokens.contentsToken(repository.getInstallation().getInstallationId());
                var metadata = github.getCommit(token, repository.getOwnerLogin(), repository.getName(), commit.getSha());
                var incoming = mapper.apiCommit(metadata, GitCommitSource.LIST_COMMITS_API);
                // The ingestion service checks the connection generation and only fills missing fields.
                // It publishes GitSourceChangedEvent so B refreshes without duplicating source rows or Task links.
                GitIngestionRetry.onConflict(() -> ingestion.ingestCommits(repository, commit.getFirstSeenRef(),
                        List.of(incoming), new GitIngestionService.IngestOrigin(null, null), true));
            } catch (GitHubApiException failure) {
                long seconds = failure.getRetryAfterSeconds() == null ? 60 : Math.max(1, failure.getRetryAfterSeconds());
                if (failure.isTransient()) retryAfter = clock.instant().plusSeconds(seconds);
                log.warn("Commit metadata remains pending: commitId={}, kind={}", commit.getId(), failure.getKind());
            } catch (RuntimeException failure) {
                log.warn("Commit metadata remains pending: commitId={}, failure={}", commit.getId(), failure.getClass().getSimpleName());
            }
        }
    }
}
