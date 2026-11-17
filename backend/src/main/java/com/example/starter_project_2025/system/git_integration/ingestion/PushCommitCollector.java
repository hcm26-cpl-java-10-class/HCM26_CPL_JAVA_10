package com.example.starter_project_2025.system.git_integration.ingestion;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitCommitSource;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommit;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCompareResult;
import com.example.starter_project_2025.system.git_integration.ingestion.model.IncomingCommit;
import com.example.starter_project_2025.system.git_integration.repository.GitCommitRepository;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookFailure;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static com.example.starter_project_2025.system.git_integration.webhook.GitWebhookJson.at;
import static com.example.starter_project_2025.system.git_integration.webhook.GitWebhookJson.text;

/**
 * SY-04: the commits of one push. GitHub puts at most {@value #PAYLOAD_LIMIT}
 * commits in a push payload; below that the payload is complete and no API call
 * is made (the normal case). When the payload was truncated:
 * <ul>
 *   <li>existing branch ({@code before} set): Compare {@code before...after}; if it
 *       reports more than {@value #COMPARE_LIMIT} commits, List Commits from
 *       {@code after} (100 per page) down to {@code before};</li>
 *   <li>new branch ({@code before} = 000…0): List Commits from {@code after} until a
 *       page reaches history already stored for the repository.</li>
 * </ul>
 * Reading stops at {@code app.github.push-max-api-pages}; the push is then stored
 * as far as it was read and reported as truncated (not an error, not retried).
 * Runs outside any transaction: no database connection is held while GitHub answers.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PushCommitCollector {

    public static final int PAYLOAD_LIMIT = 2048;
    public static final int COMPARE_LIMIT = 250;
    static final int PAGE_SIZE = 100;
    static final String ZERO_SHA = "0000000000000000000000000000000000000000";

    private final GitHubApiClient github;
    private final InstallationTokenProvider tokens;
    private final GitCommitRepository commits;
    private final GitHubPayloadMapper mapper;
    private final GitHubAppProperties properties;

    public record Collected(List<IncomingCommit> commits, GitCommitSource source, boolean truncated, int apiPages) {
    }

    public Collected collect(JsonNode payload, GitRepository repository, GitInstallation installation) {
        JsonNode array = at(payload, "commits");
        List<IncomingCommit> fromPayload = new ArrayList<>();
        if (array != null && array.isArray()) {
            array.forEach(commit -> fromPayload.add(mapper.pushCommit(commit)));
        }
        String before = text(payload, "before");
        String after = text(payload, "after");
        if (fromPayload.size() < PAYLOAD_LIMIT || isZero(after)) {
            return new Collected(fromPayload, GitCommitSource.WEBHOOK_PAYLOAD, false, 0);
        }
        if (installation == null) {
            throw GitWebhookFailure.permanent("Truncated push without an installation: commits cannot be read from GitHub");
        }
        String token = tokens.contentsToken(installation.getInstallationId());
        String owner = orElse(text(payload, "repository", "owner", "login"),
                orElse(text(payload, "repository", "owner", "name"), repository.getOwnerLogin()));
        String name = orElse(text(payload, "repository", "name"), repository.getName());
        log.info("Push payload truncated ({} commits): reading the rest from GitHub, repositoryId={}, before={}, after={}",
                fromPayload.size(), repository.getId(), before, after);
        Api api = new Api(token, owner, name);
        return isZero(before) ? listNewBranch(api, repository, after) : compareThenList(api, before, after);
    }

    private Collected compareThenList(Api api, String before, String after) {
        GitHubCompareResult first = github.compareCommits(api.token, api.owner, api.name, before, after, 1);
        int total = first.totalCommits() == null ? 0 : first.totalCommits();
        int pages = 1;
        if (total <= COMPARE_LIMIT) {
            List<IncomingCommit> collected = new ArrayList<>(map(first.commits(), GitCommitSource.COMPARE_API));
            while (collected.size() < total && pages < maxPages()) {
                pages++;
                List<GitHubCommit> page = github.compareCommits(api.token, api.owner, api.name, before, after, pages).commits();
                if (page == null || page.isEmpty()) break;
                collected.addAll(map(page, GitCommitSource.COMPARE_API));
            }
            return new Collected(collected, GitCommitSource.COMPARE_API, collected.size() < total, pages);
        }
        // More than Compare returns: walk the history from `after` down to `before`.
        List<IncomingCommit> collected = new ArrayList<>();
        boolean reachedBefore = false;
        int listPages = 0;
        for (int page = 1; page <= maxPages() && !reachedBefore && collected.size() < total; page++) {
            List<GitHubCommit> commitsPage = github.listCommits(api.token, api.owner, api.name, after, page);
            listPages++;
            for (GitHubCommit commit : commitsPage) {
                if (before.equals(commit.sha())) {
                    reachedBefore = true;
                    break;
                }
                collected.add(mapper.apiCommit(commit, GitCommitSource.LIST_COMMITS_API));
            }
            if (commitsPage.size() < PAGE_SIZE) break;
        }
        boolean truncated = !reachedBefore && collected.size() < total;
        return new Collected(collected, GitCommitSource.LIST_COMMITS_API, truncated, pages + listPages);
    }

    private Collected listNewBranch(Api api, GitRepository repository, String after) {
        List<IncomingCommit> collected = new ArrayList<>();
        int page = 1;
        for (; page <= maxPages(); page++) {
            List<GitHubCommit> commitsPage = github.listCommits(api.token, api.owner, api.name, after, page);
            Set<String> known = commitsPage.isEmpty() ? Set.of() : new HashSet<>(commits.findExistingShas(repository.getId(),
                    commitsPage.stream().map(GitHubCommit::sha).toList()));
            for (GitHubCommit commit : commitsPage) {
                if (!known.contains(commit.sha())) collected.add(mapper.apiCommit(commit, GitCommitSource.LIST_COMMITS_API));
            }
            if (!known.isEmpty() || commitsPage.size() < PAGE_SIZE) {
                return new Collected(collected, GitCommitSource.LIST_COMMITS_API, false, page);
            }
        }
        return new Collected(collected, GitCommitSource.LIST_COMMITS_API, true, page - 1);
    }

    private List<IncomingCommit> map(List<GitHubCommit> page, GitCommitSource source) {
        return page == null ? List.of() : page.stream().map(commit -> mapper.apiCommit(commit, source)).toList();
    }

    private int maxPages() {
        return properties.getPushMaxApiPages();
    }

    private static boolean isZero(String sha) {
        return sha == null || sha.isBlank() || ZERO_SHA.equals(sha) || sha.chars().allMatch(c -> c == '0');
    }

    private static String orElse(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private record Api(String token, String owner, String name) {
    }
}
