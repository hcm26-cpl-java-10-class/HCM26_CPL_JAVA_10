package com.example.starter_project_2025.system.project.developmentinsights.integration;

import com.example.starter_project_2025.system.git_integration.repository.GitCommitRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.git_integration.tasklink.GitTaskLinker;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Recovers source mapping lost between ingestion commit and its AFTER_COMMIT fast path. */
@Component
@RequiredArgsConstructor
public class GitActivitySourceMapping {
    private final GitCommitRepository commits;
    private final GitPullRequestRepository pullRequests;
    private final GitTaskLinker linker;

    @Transactional(propagation = Propagation.NEVER)
    public void recover(Long repositoryId) {
        linker.linkCommits(commits.findByRepository_IdOrderByIdAsc(repositoryId).stream().map(commit -> commit.getId()).toList());
        pullRequests.findByRepository_IdOrderByIdAsc(repositoryId).forEach(pr -> linker.linkPullRequest(pr.getId()));
    }
}
