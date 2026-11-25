package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestReview;
import com.example.starter_project_2025.system.git_integration.domain.GitReviewState;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GitPullRequestReviewRepository extends JpaRepository<GitPullRequestReview, Long> {

    Optional<GitPullRequestReview> findByPullRequest_IdAndExternalId(Long pullRequestId, Long externalId);

    @Query("select r from GitPullRequestReview r where r.repository.id = :repositoryId and r.externalId = :externalId order by r.id")
    List<GitPullRequestReview> findByRepositoryAndReviewId(Long repositoryId, Long externalId);

    List<GitPullRequestReview> findByPullRequest_IdOrderBySubmittedAtAscIdAsc(Long pullRequestId);

    List<GitPullRequestReview> findByPullRequest_IdIn(Collection<Long> pullRequestIds);

    /** WS-GH-02: the columns insights need of one review. */
    interface ReviewStatRow {
        String getReviewerLogin();
        /** GI-06: resolves the review to a project member. */
        Long getReviewerGithubId();
        LocalDateTime getSubmittedAt();
    }

    /** WS-GH-02: reviews submitted in {@code [from, to)}; a GitReviewState.PENDING (unsent) review does not count. */
    @Query("""
            select r.reviewerLogin as reviewerLogin, r.reviewerGithubId as reviewerGithubId, r.submittedAt as submittedAt
              from GitPullRequestReview r
             where r.repository.id in :repositoryIds and r.submittedAt >= :from and r.submittedAt < :to
               and r.state <> GitReviewState.PENDING""")
    List<ReviewStatRow> submittedBetween(@Param("repositoryIds") Collection<Long> repositoryIds, @Param("from") LocalDateTime from,
                                         @Param("to") LocalDateTime to);

    /** GI-06: all-time submitted reviews of a master project per reviewer. */
    @Query("""
            select r.reviewerGithubId as githubId, r.reviewerLogin as login, count(r) as count,
                   min(r.submittedAt) as firstAt, max(r.submittedAt) as lastAt
              from GitPullRequestReview r
             where r.project.id = :masterId
               and r.state <> GitReviewState.PENDING
             group by r.reviewerGithubId, r.reviewerLogin""")
    List<GitPullRequestRepository.AuthorCountRow> reviewerActivity(@Param("masterId") Long masterId);
}
