package com.example.starter_project_2025.system.project.developmentinsights.repository;

import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequestReview;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GitPullRequestReviewRepository extends JpaRepository<GitPullRequestReview, Long> {
    List<GitPullRequestReview> findAllByPullRequest_IdOrderBySubmittedAtAscIdAsc(Long pullRequestId);
    Optional<GitPullRequestReview> findFirstByPullRequest_IdAndExternalId(Long pullRequestId, Long externalId);
}
