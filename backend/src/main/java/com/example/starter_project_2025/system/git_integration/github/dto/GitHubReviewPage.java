package com.example.starter_project_2025.system.git_integration.github.dto;

import java.util.List;

/** SY-02: a further page of the submitted reviews of one pull request (more than the first page). */
public record GitHubReviewPage(List<GitHubReviewNode> reviews, boolean hasNextPage, String endCursor,
                               GitHubCommitHistoryPage.RateLimit rateLimit) {
}
