package com.example.starter_project_2025.system.git_integration.webhook.handler;

import com.example.starter_project_2025.system.git_integration.domain.GitReviewState;
import com.example.starter_project_2025.system.git_integration.ingestion.GitHubPayloadMapper;
import com.example.starter_project_2025.system.git_integration.ingestion.GitIngestionRetry;
import com.example.starter_project_2025.system.git_integration.ingestion.GitIngestionService;
import com.example.starter_project_2025.system.git_integration.ingestion.GitReviewReconciler;
import com.example.starter_project_2025.system.git_integration.ingestion.model.IncomingPullRequest;
import com.example.starter_project_2025.system.git_integration.ingestion.model.IncomingReview;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookContext;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookEventHandler;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookHandlerResult;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookJson;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * SY-04 AC02 / AC05: submitted, edited and dismissed reviews. The pull request
 * embedded in the payload is upserted first (same out-of-order guard), so a review
 * arriving before its pull request's own event is never orphaned. A review is only
 * overwritten by a strictly newer (pull request updated_at, action rank) pair.
 */
@Component
@RequiredArgsConstructor
public class PullRequestReviewEventHandler implements GitWebhookEventHandler {

    private final GitHubPayloadMapper mapper;
    private final GitIngestionService ingestion;
    private final GitReviewReconciler reconciler;
    @Value("${app.github.review-reconcile-enabled:true}")
    private boolean reconcileEnabled;

    @Override
    public Set<String> eventTypes() {
        return Set.of("pull_request_review");
    }

    @Override
    public GitWebhookHandlerResult handle(GitWebhookContext context) {
        Optional<GitWebhookHandlerResult> skip = LinkedRepositoryGuard.check(context);
        if (skip.isPresent()) return skip.get();

        String action = context.action() == null ? "" : context.action();
        if (!GitHubPayloadMapper.REVIEW_ACTION_RANK.containsKey(action)) {
            return GitWebhookHandlerResult.ignored("Unsupported action: " + action);
        }
        JsonNode prNode = GitWebhookJson.at(context.payload(), "pull_request");
        JsonNode reviewNode = GitWebhookJson.at(context.payload(), "review");
        IncomingReview review = mapper.review(reviewNode, prNode, action);
        if (review.state() == GitReviewState.PENDING) {
            return GitWebhookHandlerResult.ignored("Pending (draft) review");
        }
        IncomingPullRequest pr = mapper.pullRequest(prNode);
        GitIngestionService.PullRequestUpsert pullRequest = GitIngestionRetry.onConflict(() ->
                ingestion.upsertPullRequest(context.repository(), pr, "review_" + action, context.eventId()));
        GitIngestionService.ReviewUpsert result = GitIngestionRetry.onConflict(() ->
                reconcileEnabled ? reconciler.reconcile(context.repository(), pullRequest.pullRequestId(), review.externalId(), action,
                        GitIngestionService.IngestOrigin.webhook(context.eventId()))
                        : ingestion.upsertReview(context.repository(), pullRequest.pullRequestId(), review, action, context.eventId()));
        if (!result.applied()) {
            return GitWebhookHandlerResult.processed("Stale review event skipped for review " + review.externalId()
                    + " on #" + pr.number(), 0);
        }
        return GitWebhookHandlerResult.processed("Review " + review.externalId() + " on #" + pr.number()
                + (result.created() ? " created" : " updated") + " (" + review.state() + ")", 1);
    }
}
