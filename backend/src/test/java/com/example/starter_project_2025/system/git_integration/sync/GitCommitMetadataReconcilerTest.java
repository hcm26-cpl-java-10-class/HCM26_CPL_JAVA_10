package com.example.starter_project_2025.system.git_integration.sync;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitCommit;
import com.example.starter_project_2025.system.git_integration.domain.GitCommitSource;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommit;
import com.example.starter_project_2025.system.git_integration.ingestion.GitHubPayloadMapper;
import com.example.starter_project_2025.system.git_integration.ingestion.GitIngestionService;
import com.example.starter_project_2025.system.git_integration.ingestion.event.CommitIngestedEvent;
import com.example.starter_project_2025.system.git_integration.ingestion.model.IncomingCommit;
import com.example.starter_project_2025.system.git_integration.repository.GitCommitRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GitCommitMetadataReconcilerTest {
    @Mock GitCommitRepository commits;
    @Mock GitHubApiClient github;
    @Mock InstallationTokenProvider tokens;
    @Mock GitHubPayloadMapper mapper;
    @Mock GitIngestionService ingestion;
    GitHubAppProperties properties;
    GitCommitMetadataReconciler reconciler;
    final Clock clock = Clock.fixed(Instant.parse("2026-11-24T10:00:00Z"), ZoneOffset.UTC);

    @BeforeEach void setUp() {
        properties = new GitHubAppProperties();
        properties.setEnabled(true);
        reconciler = new GitCommitMetadataReconciler(properties, commits, github, tokens, mapper, ingestion, clock);
    }

    private GitCommit stored(long id) {
        var installation = GitInstallation.builder().id(1L).installationId(101L).build();
        var repository = GitRepository.builder().id(2L).installation(installation).ownerLogin("owner").name("repo").build();
        return GitCommit.builder().id(id).repository(repository).sha("sha-" + id)
                .firstSeenRef("refs/heads/feature").build();
    }

    @Test void enrichesOffDefaultBranchThroughCanonicalIngestionWithoutChangingItsRef() {
        var row = stored(7);
        var metadata = new GitHubCommit(row.getSha(), "https://github.com/owner/repo/commit/sha-7", null,
                null, null, List.of(new GitHubCommit.Parent("first"), new GitHubCommit.Parent("second")));
        var incoming = new IncomingCommit(row.getSha(), "merge", null, null, null, null, null, null, null,
                null, null, metadata.htmlUrl(), null, 2, GitCommitSource.LIST_COMMITS_API);
        when(commits.findMissingMetadataByIds(eq(List.of(7L)), any(Pageable.class))).thenReturn(List.of(row));
        when(tokens.contentsToken(101L)).thenReturn("fixture-credential");
        when(github.getCommit("fixture-credential", "owner", "repo", row.getSha())).thenReturn(metadata);
        when(mapper.apiCommit(metadata, GitCommitSource.LIST_COMMITS_API)).thenReturn(incoming);
        when(ingestion.ingestCommits(eq(row.getRepository()), eq(row.getFirstSeenRef()), eq(List.of(incoming)),
                any(GitIngestionService.IngestOrigin.class), eq(true)))
                .thenReturn(new GitIngestionService.CommitIngestResult(0, 1, 1));
        reconciler.afterIngestion(new CommitIngestedEvent(1L, 1L, 2L, 3L, row.getFirstSeenRef(), List.of(7L)));
        verify(ingestion).ingestCommits(row.getRepository(), "refs/heads/feature", List.of(incoming),
                new GitIngestionService.IngestOrigin(null, null), true);
    }

    @Test void scheduledFallbackHandlesAnEmptyPendingBatchWithoutGitHubCalls() {
        when(commits.findMissingMetadata(eq(0L), any(Pageable.class))).thenReturn(List.of());
        reconciler.scheduled();
        verify(commits).findMissingMetadata(eq(0L), any(Pageable.class));
        verifyNoInteractions(github, tokens, mapper, ingestion);
    }

    @Test void disabledIntegrationDoesNotMakeGitHubOrDatabaseCalls() {
        properties.setEnabled(false);
        reconciler.scheduled();
        reconciler.afterIngestion(new CommitIngestedEvent(1L, 1L, 2L, 3L, "refs/heads/feature", List.of(7L)));
        verifyNoInteractions(commits, github, tokens, mapper, ingestion);
    }

    @Test void rateLimitDefersFurtherRequestsUntilRetryTime() {
        var row = stored(7);
        when(commits.findMissingMetadata(eq(0L), any(Pageable.class))).thenReturn(List.of(row));
        when(tokens.contentsToken(101L)).thenReturn("fixture-credential");
        when(github.getCommit(anyString(), anyString(), anyString(), anyString()))
                .thenThrow(new GitHubApiException(GitHubApiException.Kind.RATE_LIMITED, "test", 429, 120L));
        reconciler.scheduled();
        reconciler.scheduled();
        verify(commits, times(1)).findMissingMetadata(eq(0L), any(Pageable.class));
        verify(github, times(1)).getCommit(anyString(), anyString(), anyString(), anyString());
        verifyNoInteractions(ingestion);
    }
}
