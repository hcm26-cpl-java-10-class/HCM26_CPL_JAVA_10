package com.example.starter_project_2025.system.git_integration.ingestion.model;

import com.example.starter_project_2025.system.git_integration.domain.GitReviewState;

import java.time.LocalDateTime;

/**
 * SY-04: a review normalized from a {@code pull_request_review} payload.
 * {@code sourceUpdatedAt} + {@code actionRank} order versions of the same review (AC05).
 */
public record IncomingReview(
        Long externalId,
        String reviewerLogin,
        Long reviewerGithubId,
        GitReviewState state,
        String body,
        String commitSha,
        LocalDateTime submittedAt,
        String htmlUrl,
        LocalDateTime sourceUpdatedAt,
        int actionRank) {
}
