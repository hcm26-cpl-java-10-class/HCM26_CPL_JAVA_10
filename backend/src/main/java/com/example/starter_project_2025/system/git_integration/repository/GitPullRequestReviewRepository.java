package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface GitPullRequestReviewRepository extends JpaRepository<GitPullRequestReview, Long> {

    Optional<GitPullRequestReview> findByRepositoryIdAndExternalId(Long repositoryId, Long externalId);

    List<GitPullRequestReview> findByPullRequestIdOrderBySubmittedAtAscIdAsc(Long pullRequestId);

    List<GitPullRequestReview> findByPullRequestIdIn(Collection<Long> pullRequestIds);

    /** WS-GH-02: the columns insights need of one review. */
    interface ReviewStatRow {
        String getReviewerLogin();
        LocalDateTime getSubmittedAt();
    }

    /** WS-GH-02: reviews submitted in {@code [from, to)}; a PENDING (unsent) review does not count. */
    @Query("""
            select r.reviewerLogin as reviewerLogin, r.submittedAt as submittedAt
              from GitPullRequestReview r
             where r.repositoryId = :repositoryId and r.submittedAt >= :from and r.submittedAt < :to
               and r.state <> com.example.starter_project_2025.system.git_integration.domain.GitReviewState.PENDING""")
    List<ReviewStatRow> submittedBetween(@Param("repositoryId") Long repositoryId, @Param("from") LocalDateTime from,
                                         @Param("to") LocalDateTime to);
}
