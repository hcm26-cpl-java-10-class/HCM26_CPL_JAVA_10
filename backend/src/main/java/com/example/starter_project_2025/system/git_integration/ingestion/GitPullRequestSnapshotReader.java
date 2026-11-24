package com.example.starter_project_2025.system.git_integration.ingestion;

import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.ingestion.model.IncomingPullRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Resolves snapshots with equal GitHub timestamps using the current source, under the ingestion's repo lock. */
@Component
@RequiredArgsConstructor
public class GitPullRequestSnapshotReader {
    private final GitHubApiClient github;
    private final InstallationTokenProvider tokens;
    private final GitHubPayloadMapper mapper;

    public IncomingPullRequest current(GitRepository repository, int number) {
        String token = tokens.contentsToken(repository.getInstallation().getInstallationId());
        var node = github.getPullRequest(token, repository.getOwnerLogin(), repository.getName(), number);
        if (node == null || node.path("number").asInt() != number) throw new IllegalStateException("GitHub Pull Request is unavailable");
        return mapper.pullRequest(node);
    }
}
