package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestReview;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface GitPullRequestReviewRepository extends JpaRepository<GitPullRequestReview, Long> {

    Optional<GitPullRequestReview> findByRepositoryIdAndExternalId(Long repositoryId, Long externalId);

    List<GitPullRequestReview> findByPullRequestIdOrderBySubmittedAtAscIdAsc(Long pullRequestId);

    List<GitPullRequestReview> findByPullRequestIdIn(Collection<Long> pullRequestIds);
}
