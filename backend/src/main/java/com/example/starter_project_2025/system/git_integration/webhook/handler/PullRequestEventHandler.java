package com.example.starter_project_2025.system.git_integration.webhook.handler;

import com.example.starter_project_2025.system.git_integration.ingestion.GitHubPayloadMapper;
import com.example.starter_project_2025.system.git_integration.ingestion.GitIngestionRetry;
import com.example.starter_project_2025.system.git_integration.ingestion.GitIngestionService;
import com.example.starter_project_2025.system.git_integration.ingestion.model.IncomingPullRequest;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookContext;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookEventHandler;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookHandlerResult;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookJson;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.Set;

/**
 * SY-04 AC02 / AC05: every pull_request action carries the whole pull request, so
 * each one upserts it. A payload older than the stored {@code updated_at} is
 * skipped; the event is still PROCESSED (it was handled correctly).
 */
@Component
@RequiredArgsConstructor
public class PullRequestEventHandler implements GitWebhookEventHandler {

    private final GitHubPayloadMapper mapper;
    private final GitIngestionService ingestion;

    @Override
    public Set<String> eventTypes() {
        return Set.of("pull_request");
    }

    @Override
    public GitWebhookHandlerResult handle(GitWebhookContext context) {
        Optional<GitWebhookHandlerResult> skip = LinkedRepositoryGuard.check(context);
        if (skip.isPresent()) return skip.get();

        IncomingPullRequest pr = mapper.pullRequest(GitWebhookJson.at(context.payload(), "pull_request"));
        GitIngestionService.PullRequestUpsert result = GitIngestionRetry.onConflict(() ->
                ingestion.upsertPullRequest(context.repository(), pr, context.action(), context.eventId()));
        if (!result.applied()) {
            return GitWebhookHandlerResult.processed("Stale event skipped for #" + pr.number()
                    + ": payload updated_at=" + pr.updatedAt() + ", stored updated_at=" + result.storedUpdatedAt());
        }
        return GitWebhookHandlerResult.processed("Pull request #" + pr.number() + (result.created() ? " created" : " updated")
                + " (" + pr.state() + ")");
    }
}
