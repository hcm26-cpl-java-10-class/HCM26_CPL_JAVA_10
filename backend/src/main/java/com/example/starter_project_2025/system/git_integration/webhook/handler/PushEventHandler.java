package com.example.starter_project_2025.system.git_integration.webhook.handler;

import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.ingestion.GitIngestionRetry;
import com.example.starter_project_2025.system.git_integration.ingestion.GitIngestionService;
import com.example.starter_project_2025.system.git_integration.ingestion.PushCommitCollector;
import com.example.starter_project_2025.system.git_integration.service.GitBranchWriter;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookContext;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookEventHandler;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookHandlerResult;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookJson;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.Set;

/**
 * SY-04 AC01: a push to a linked repository stores its commits (immutable by SHA,
 * {@code first_seen_ref} = the pushed ref) and publishes {@code CommitIngestedEvent}.
 * Tag pushes are ignored; a deleted branch has no commits to store. SY-07: the branch head is kept
 * in {@code git_branches}.
 */
@Component
@RequiredArgsConstructor
public class PushEventHandler implements GitWebhookEventHandler {

    private final PushCommitCollector collector;
    private final GitIngestionService ingestion;
    private final GitBranchWriter branches;

    @Override
    public Set<String> eventTypes() {
        return Set.of("push");
    }

    @Override
    public GitWebhookHandlerResult handle(GitWebhookContext context) {
        Optional<GitWebhookHandlerResult> skip = LinkedRepositoryGuard.check(context);
        if (skip.isPresent()) return skip.get();

        String ref = GitWebhookJson.text(context.payload(), "ref");
        if (ref == null || ref.isBlank()) {
            return GitWebhookHandlerResult.ignored("Push without a ref");
        }
        if (ref.startsWith("refs/tags/")) {
            return GitWebhookHandlerResult.ignored("Tag push");
        }
        GitRepository repository = context.repository();
        if (Boolean.TRUE.equals(bool(context, "deleted"))) {
            GitIngestionRetry.onConflict(() -> {
                branches.onDeleted(repository.getId(), ref); // SY-07
                return null;
            });
            return GitWebhookHandlerResult.processed("Branch deleted: no commits to store", 0);
        }
        PushCommitCollector.Collected collected = collector.collect(context.payload(), repository, context.installation());
        GitIngestionService.CommitIngestResult result = GitIngestionRetry.onConflict(() ->
                ingestion.ingestCommits(repository, ref, collected.commits(), context.eventId()));
        // SY-07: the branch head moved; a later sync reads only what this push could not bring.
        String before = GitWebhookJson.text(context.payload(), "before");
        String after = GitWebhookJson.text(context.payload(), "after");
        String headDate = GitWebhookJson.text(context.payload(), "head_commit", "timestamp");
        GitIngestionRetry.onConflict(() -> {
            branches.onPush(repository, ref, before, after, headDate, !collected.truncated());
            return null;
        });
        return GitWebhookHandlerResult.processed("ref=" + ref + ", inserted=" + result.inserted()
                + ", existing=" + result.existing() + ", source=" + collected.source()
                + (collected.apiPages() > 0 ? ", apiPages=" + collected.apiPages() : "")
                + (collected.truncated() ? ", truncated=true" : ""),
                result.inserted() + result.existing(), collected.truncated());
    }

    private static Boolean bool(GitWebhookContext context, String key) {
        var node = GitWebhookJson.at(context.payload(), key);
        return node == null ? null : node.asBoolean(false);
    }
}
