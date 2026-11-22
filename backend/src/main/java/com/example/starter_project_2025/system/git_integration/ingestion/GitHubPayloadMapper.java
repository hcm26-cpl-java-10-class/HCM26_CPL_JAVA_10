package com.example.starter_project_2025.system.git_integration.ingestion;

import com.example.starter_project_2025.system.git_integration.domain.GitCommitSource;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestState;
import com.example.starter_project_2025.system.git_integration.domain.GitReviewState;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommit;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubHistoryCommit;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubPullRequestNode;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubReviewNode;
import com.example.starter_project_2025.system.git_integration.ingestion.model.IncomingCommit;
import com.example.starter_project_2025.system.git_integration.ingestion.model.IncomingPullRequest;
import com.example.starter_project_2025.system.git_integration.ingestion.model.IncomingReview;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookFailure;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.Optional;

import static com.example.starter_project_2025.system.git_integration.webhook.GitWebhookJson.at;
import static com.example.starter_project_2025.system.git_integration.webhook.GitWebhookJson.limit;
import static com.example.starter_project_2025.system.git_integration.webhook.GitWebhookJson.number;
import static com.example.starter_project_2025.system.git_integration.webhook.GitWebhookJson.text;

/**
 * SY-04: turns GitHub webhook payloads and API responses into the ingestion model.
 * GitHub timestamps (ISO-8601 with offset) are converted to the zone of
 * {@code gitIntegrationClock}, the zone of every other timestamp of the module.
 */
@Component
public class GitHubPayloadMapper {

    /** Order of review actions sharing one {@code source_updated_at} (AC05). */
    public static final Map<String, Integer> REVIEW_ACTION_RANK = Map.of("submitted", 1, "edited", 2, "dismissed", 3);

    private final Clock clock;

    public GitHubPayloadMapper(@Qualifier("gitIntegrationClock") Clock clock) {
        this.clock = clock;
    }

    /** One element of a push payload's {@code commits} array. */
    public IncomingCommit pushCommit(JsonNode commit) {
        LocalDateTime timestamp = time(text(commit, "timestamp"));
        return new IncomingCommit(
                text(commit, "id"),
                limit(text(commit, "message"), 4000),
                limit(text(commit, "author", "name"), 255),
                limit(text(commit, "author", "email"), 255),
                limit(text(commit, "author", "username"), 100),
                null,
                limit(text(commit, "committer", "name"), 255),
                limit(text(commit, "committer", "email"), 255),
                limit(text(commit, "committer", "username"), 100),
                timestamp,
                timestamp == null ? now() : timestamp,
                limit(text(commit, "url"), 500),
                countFiles(commit),
                null,
                GitCommitSource.WEBHOOK_PAYLOAD);
    }

    public IncomingCommit apiCommit(GitHubCommit commit, GitCommitSource source) {
        GitHubCommit.GitData data = commit.commit();
        GitHubCommit.Person author = data == null ? null : data.author();
        GitHubCommit.Person committer = data == null ? null : data.committer();
        LocalDateTime committedAt = committer == null ? null : time(committer.date());
        return new IncomingCommit(
                commit.sha(),
                limit(data == null ? null : data.message(), 4000),
                limit(author == null ? null : author.name(), 255),
                limit(author == null ? null : author.email(), 255),
                limit(commit.author() == null ? null : commit.author().login(), 100),
                commit.author() == null ? null : commit.author().id(),
                limit(committer == null ? null : committer.name(), 255),
                limit(committer == null ? null : committer.email(), 255),
                limit(commit.committer() == null ? null : commit.committer().login(), 100),
                author == null ? null : time(author.date()),
                committedAt == null ? now() : committedAt,
                limit(commit.htmlUrl(), 500),
                null,
                commit.parents() == null ? null : commit.parents().size(),
                source);
    }

    /** SY-01: a commit of the GraphQL history; the Git identity and the GitHub account stay separate. */
    public IncomingCommit historyCommit(GitHubHistoryCommit commit) {
        GitHubHistoryCommit.Person author = commit.author();
        GitHubHistoryCommit.Person committer = commit.committer();
        LocalDateTime authoredAt = time(commit.authoredDate());
        LocalDateTime committedAt = time(commit.committedDate());
        return new IncomingCommit(
                commit.oid(),
                limit(commit.message(), 4000),
                limit(author == null ? null : author.name(), 255),
                limit(author == null ? null : author.email(), 255),
                limit(author == null ? null : author.login(), 100),
                author == null ? null : author.databaseId(),
                limit(committer == null ? null : committer.name(), 255),
                limit(committer == null ? null : committer.email(), 255),
                limit(committer == null ? null : committer.login(), 100),
                authoredAt,
                committedAt != null ? committedAt : authoredAt != null ? authoredAt : now(),
                limit(commit.url(), 500),
                null,
                commit.parentCount(),
                GitCommitSource.GRAPHQL_HISTORY);
    }

    /**
     * SY-02: a pull request of the GraphQL list. Merged wins over the state (AC03): a pull request
     * closed without merging is CLOSED (AC04), the same rule as {@link #pullRequest(JsonNode)}.
     */
    public IncomingPullRequest historyPullRequest(GitHubPullRequestNode pr) {
        LocalDateTime createdAt = time(pr.createdAt());
        LocalDateTime updatedAt = time(pr.updatedAt());
        if (updatedAt == null) updatedAt = createdAt != null ? createdAt : now();
        LocalDateTime mergedAt = time(pr.mergedAt());
        GitPullRequestState state = pr.merged() || mergedAt != null ? GitPullRequestState.MERGED
                : "CLOSED".equalsIgnoreCase(pr.state()) ? GitPullRequestState.CLOSED : GitPullRequestState.OPEN;
        return new IncomingPullRequest(
                pr.databaseId(),
                pr.number(),
                limit(orDefault(pr.title(), "#" + pr.number()), 500),
                limit(pr.body(), 4000),
                state,
                pr.draft(),
                limit(pr.author() == null ? null : pr.author().login(), 100),
                pr.author() == null ? null : pr.author().databaseId(),
                limit(pr.headRefName(), 255),
                limit(pr.headRefOid(), 64),
                limit(pr.baseRefName(), 255),
                limit(pr.mergeCommitOid(), 64),
                limit(pr.mergedByLogin(), 100),
                pr.commitsCount(),
                pr.additions(),
                pr.deletions(),
                pr.changedFiles(),
                limit(pr.url(), 500),
                createdAt == null ? updatedAt : createdAt,
                updatedAt,
                time(pr.closedAt()),
                mergedAt);
    }

    /**
     * SY-02: a submitted review of the GraphQL list. Its version is the {@code updatedAt} of the pull
     * request it was read with, the same measure as webhook reviews ({@link #review}), with rank 0 so
     * a webhook version of the same moment wins. Empty for an unknown or PENDING state (AC06).
     */
    public Optional<IncomingReview> historyReview(GitHubReviewNode review, LocalDateTime pullRequestUpdatedAt) {
        GitReviewState state = GitReviewState.fromGitHub(review.state()).orElse(null);
        if (review.databaseId() == null || state == null || state == GitReviewState.PENDING) return Optional.empty();
        LocalDateTime submittedAt = time(review.submittedAt());
        LocalDateTime source = pullRequestUpdatedAt != null ? pullRequestUpdatedAt : submittedAt != null ? submittedAt : now();
        return Optional.of(new IncomingReview(
                review.databaseId(),
                limit(review.author() == null ? null : review.author().login(), 100),
                review.author() == null ? null : review.author().databaseId(),
                state,
                limit(review.body(), 4000),
                limit(review.commitOid(), 64),
                submittedAt,
                limit(review.url(), 500),
                source,
                0));
    }

    /** The {@code pull_request} object of a pull_request or pull_request_review payload. */
    public IncomingPullRequest pullRequest(JsonNode pr) {
        Long number = number(pr, "number");
        LocalDateTime updatedAt = time(text(pr, "updated_at"));
        if (pr == null || number == null || updatedAt == null) {
            throw GitWebhookFailure.permanent("The payload has no pull_request number or updated_at");
        }
        boolean merged = bool(pr, "merged") || at(pr, "merged_at") != null;
        GitPullRequestState state = merged ? GitPullRequestState.MERGED
                : "closed".equalsIgnoreCase(text(pr, "state")) ? GitPullRequestState.CLOSED : GitPullRequestState.OPEN;
        LocalDateTime createdAt = time(text(pr, "created_at"));
        return new IncomingPullRequest(
                number(pr, "id"),
                number.intValue(),
                limit(orDefault(text(pr, "title"), "#" + number), 500),
                limit(text(pr, "body"), 4000),
                state,
                bool(pr, "draft"),
                limit(text(pr, "user", "login"), 100),
                number(pr, "user", "id"),
                limit(text(pr, "head", "ref"), 255),
                limit(text(pr, "head", "sha"), 64),
                limit(text(pr, "base", "ref"), 255),
                limit(text(pr, "merge_commit_sha"), 64),
                limit(text(pr, "merged_by", "login"), 100),
                integer(pr, "commits"),
                integer(pr, "additions"),
                integer(pr, "deletions"),
                integer(pr, "changed_files"),
                limit(text(pr, "html_url"), 500),
                createdAt == null ? updatedAt : createdAt,
                updatedAt,
                time(text(pr, "closed_at")),
                time(text(pr, "merged_at")));
    }

    /**
     * The {@code review} object of a pull_request_review payload. Its version is the pull
     * request's {@code updated_at} of the same payload (a review has no updated_at), falling
     * back to {@code submitted_at}, then the action rank.
     */
    public IncomingReview review(JsonNode review, JsonNode pullRequest, String action) {
        Long id = number(review, "id");
        GitReviewState state = "dismissed".equals(action) ? GitReviewState.DISMISSED
                : GitReviewState.fromGitHub(text(review, "state")).orElse(null);
        if (id == null || state == null) {
            throw GitWebhookFailure.permanent("The payload has no review id or a known review state");
        }
        LocalDateTime submittedAt = time(text(review, "submitted_at"));
        LocalDateTime source = time(text(pullRequest, "updated_at"));
        if (source == null) source = submittedAt != null ? submittedAt : now();
        return new IncomingReview(
                id,
                limit(text(review, "user", "login"), 100),
                number(review, "user", "id"),
                state,
                limit(text(review, "body"), 4000),
                limit(text(review, "commit_id"), 64),
                submittedAt,
                limit(text(review, "html_url"), 500),
                source,
                REVIEW_ACTION_RANK.getOrDefault(action, 0));
    }

    /** ISO-8601 instant → local time of the module clock; null when absent or unreadable. */
    public LocalDateTime time(String iso) {
        if (iso == null || iso.isBlank()) return null;
        try {
            return OffsetDateTime.parse(iso).atZoneSameInstant(clock.getZone()).toLocalDateTime();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

    private static Integer countFiles(JsonNode commit) {
        int count = 0;
        boolean any = false;
        for (String key : new String[]{"added", "removed", "modified"}) {
            JsonNode files = at(commit, key);
            if (files != null && files.isArray()) {
                count += files.size();
                any = true;
            }
        }
        return any ? count : null;
    }

    private static boolean bool(JsonNode node, String key) {
        JsonNode value = at(node, key);
        return value != null && value.asBoolean(false);
    }

    private static Integer integer(JsonNode node, String key) {
        Long value = number(node, key);
        return value == null ? null : value.intValue();
    }

    private static String orDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
