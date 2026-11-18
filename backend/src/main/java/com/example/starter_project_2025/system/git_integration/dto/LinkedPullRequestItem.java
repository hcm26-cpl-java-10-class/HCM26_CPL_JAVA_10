package com.example.starter_project_2025.system.git_integration.dto;

/** TM-03: a pull request of a task together with how it was linked. */
public record LinkedPullRequestItem(GitPullRequestItem pullRequest, BacklogGitLinkInfo link) {
}
