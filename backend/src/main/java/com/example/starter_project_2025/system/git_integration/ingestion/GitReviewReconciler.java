package com.example.starter_project_2025.system.git_integration.ingestion;

import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.ingestion.model.IncomingReview;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestReviewRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookJson;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The PR lock covers the remote read and write: an older fetched review cannot win a later race. */
@Service
@RequiredArgsConstructor
public class GitReviewReconciler {
    private final GitPullRequestRepository pullRequests;
    private final GitHubApiClient github;
    private final InstallationTokenProvider tokens;
    private final GitHubPayloadMapper mapper;
    private final GitIngestionService ingestion;
    private final GitRepositoryRepository repositories;
    private final GitPullRequestReviewRepository reviews;

    @Transactional
    public GitIngestionService.ReviewUpsert reconcile(GitRepository repository, Long pullRequestId,
            long reviewId, String action, GitIngestionService.IngestOrigin origin) {
        repositories.lockById(repository.getId()).orElseThrow();
        var pr = pullRequests.lockById(pullRequestId).orElseThrow();
        var currentRepository = pr.getRepository();
        if (!currentRepository.getStatus().receivesEvents()
                || !currentRepository.getInstallationRef().equals(repository.getInstallationRef())
                || !java.util.Objects.equals(currentRepository.getLinkedAt(), repository.getLinkedAt())) {
            return new GitIngestionService.ReviewUpsert(null, false, false);
        }
        String token = tokens.contentsToken(currentRepository.getInstallation().getInstallationId());
        var node = github.getPullRequestReview(token, currentRepository.getOwnerLogin(), currentRepository.getName(), pr.getNumber(), reviewId);
        if (node == null || GitWebhookJson.number(node, "id") == null
                || GitWebhookJson.number(node, "id") != reviewId) throw new IllegalStateException("GitHub review response is unavailable");
        var review = mapper.review(node, null, "reconciled");
        var stored = reviews.findByPullRequest_IdAndExternalId(pullRequestId, reviewId).orElse(null);
        if (stored != null && stored.getState() == review.state()
                && java.util.Objects.equals(stored.getBody(), review.body())
                && java.util.Objects.equals(stored.getSubmittedAt(), review.submittedAt())
                && java.util.Objects.equals(stored.getReviewerGithubId(), review.reviewerGithubId())
                && java.util.Objects.equals(stored.getReviewerLogin(), review.reviewerLogin())) {
            return new GitIngestionService.ReviewUpsert(stored.getId(), false, false);
        }
        var version = LocalDateTime.now();
        if (stored != null && !version.isAfter(stored.getSourceUpdatedAt())) version = stored.getSourceUpdatedAt().plusNanos(1000);
        IncomingReview canonical = new IncomingReview(review.externalId(), review.reviewerLogin(), review.reviewerGithubId(),
                review.state(), review.body(), review.commitSha(), review.submittedAt(), review.htmlUrl(), version, 0);
        return ingestion.upsertReview(currentRepository, pullRequestId, canonical, action, origin);
    }
}
