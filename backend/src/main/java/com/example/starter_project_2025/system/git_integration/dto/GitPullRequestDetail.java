package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitReviewState;

import java.time.LocalDateTime;
import java.util.List;

/** SY-04: a pull request with its reviews, oldest first. */
public record GitPullRequestDetail(GitPullRequestItem pullRequest, String body, String mergedByLogin,
                                   Integer commitsCount, List<Review> reviews) {

    public record Review(Long id, String reviewerLogin, GitReviewState state, String body, String commitSha,
                         LocalDateTime submittedAt, LocalDateTime dismissedAt, String htmlUrl) {
    }
}
