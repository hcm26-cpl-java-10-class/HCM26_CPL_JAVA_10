package com.example.starter_project_2025.system.git_integration.contributor;

import com.example.starter_project_2025.system.git_integration.ingestion.event.CommitIngestedEvent;
import com.example.starter_project_2025.system.git_integration.ingestion.event.PullRequestIngestedEvent;
import com.example.starter_project_2025.system.git_integration.ingestion.event.ReviewIngestedEvent;
import com.example.starter_project_2025.system.git_integration.repository.GitCommitRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitContributorRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestReviewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * GI-06: records the authors of newly synchronized commits, pull requests and reviews as
 * contributors of the master project (and refreshes a renamed login, AC08). A failure never
 * touches the webhook event: the Members view fills in missing contributors when it is read.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GitContributorIngestionListener {

    private final GitContributorRegistry registry;
    private final GitCommitRepository commits;
    private final GitPullRequestRepository pullRequests;
    private final GitPullRequestReviewRepository reviews;
    private final GitContributorRepository contributors;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCommits(CommitIngestedEvent event) {
        try {
            ContributorDirectory directory = new ContributorDirectory(contributors.findByMasterProject_IdOrderByIdAsc(event.projectId()));
            ContributorSightings sightings = new ContributorSightings();
            commits.findAllById(event.commitIds()).forEach(commit -> sightings.add(directory, commit.getAuthorGithubId(),
                    commit.getAuthorEmail(), commit.getAuthorLogin(), commit.getAuthorName(), commit.getCommittedAt(),
                    commit.getCommittedAt()));
            registry.record(event.tenantId(), event.projectId(), sightings);
        } catch (RuntimeException failure) {
            log.warn("Contributors of {} commit(s) of repository {} not recorded now", event.commitIds().size(),
                    event.repositoryId(), failure);
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPullRequest(PullRequestIngestedEvent event) {
        try {
            pullRequests.findById(event.pullRequestId()).ifPresent(pr -> registry.record(event.tenantId(), event.projectId(),
                    new ContributorSightings().add(pr.getAuthorGithubId(), null, pr.getAuthorLogin(), null, pr.getGithubCreatedAt())));
        } catch (RuntimeException failure) {
            log.warn("Author of pull request #{} of repository {} not recorded now", event.number(), event.repositoryId(), failure);
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onReview(ReviewIngestedEvent event) {
        try {
            reviews.findById(event.reviewId()).ifPresent(review -> registry.record(event.tenantId(), event.projectId(),
                    new ContributorSightings().add(review.getReviewerGithubId(), null, review.getReviewerLogin(), null,
                            review.getSubmittedAt() != null ? review.getSubmittedAt() : review.getSourceUpdatedAt())));
        } catch (RuntimeException failure) {
            log.warn("Reviewer of review {} of repository {} not recorded now", event.reviewId(), event.repositoryId(), failure);
        }
    }
}
