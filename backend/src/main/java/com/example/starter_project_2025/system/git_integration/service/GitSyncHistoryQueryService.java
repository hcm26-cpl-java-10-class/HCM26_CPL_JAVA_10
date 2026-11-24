package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncHistorySource;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncHistoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncHistoryType;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJob;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEvent;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEventStatus;
import com.example.starter_project_2025.system.git_integration.dto.GitRepositoryLabel;
import com.example.starter_project_2025.system.git_integration.dto.GitSyncHistoryDetail;
import com.example.starter_project_2025.system.git_integration.dto.GitSyncHistoryItem;
import com.example.starter_project_2025.system.git_integration.dto.GitSyncHistoryPage;
import com.example.starter_project_2025.system.git_integration.dto.ProjectRepositoryView;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.repository.GitSyncHistoryRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitSyncJobRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitWebhookEventRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * SY-06: synchronization history of a project's repositories (AC01–AC03).
 * <ul>
 *   <li>BR5: only whoever manages the master project (its PM, or a Git Integration manager) sees it;
 *       a module reads its master's history under the same rule.</li>
 *   <li>Defaults to the current repository; any repository of the master can be chosen (GI-05),
 *       a repository of another project is 404.</li>
 *   <li>Merges sync jobs and webhook deliveries carrying Git data ({@link GitSyncHistoryRepository}).</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class GitSyncHistoryQueryService {

    static final int DEFAULT_SIZE = 20;
    static final int MAX_SIZE = 100;
    private static final int ERROR_LINE = 200;

    private final GitIntegrationAccessService access;
    private final RepositoryActivityQueryService activity;
    private final GitRepositoryLinkPolicy policy;
    private final GitSyncHistoryRepository history;
    private final GitSyncJobRepository jobs;
    private final GitWebhookEventRepository events;
    private final UserRepository users;
    private final GitHubAppProperties properties;
    private final ObjectMapper json;

    public record HistoryQuery(GitSyncHistoryType type, GitSyncHistoryStatus status, Long repositoryId, int page, int size) {
    }

    @Transactional(readOnly = true)
    public GitSyncHistoryPage list(Long projectId, HistoryQuery query) {
        RepositoryActivityQueryService.ProjectRepositories scope = scope(projectId);
        int page = Math.max(query.page(), 0);
        int size = query.size() < 1 ? DEFAULT_SIZE : Math.min(query.size(), MAX_SIZE);
        if (scope.isEmpty()) {
            return new GitSyncHistoryPage(List.of(), page, size, 0, 0, false, null, List.of());
        }
        Long repositoryId = query.repositoryId() != null ? scope.select(query.repositoryId()).get(0)
                : scope.current() != null ? scope.current().getId()
                : scope.ids().get(0); // newest repository when none is linked now
        GitSyncHistoryRepository.Filter filter = new GitSyncHistoryRepository.Filter(List.of(repositoryId), query.type(), query.status());
        long total = history.count(filter);
        List<GitSyncHistoryItem> items = total == 0 ? List.of()
                : history.page(filter, page, size).stream().map(row -> item(row, scope)).toList();
        return new GitSyncHistoryPage(items, page, size, total, (int) ((total + size - 1) / size), true, repositoryId,
                scope.labels());
    }

    /** AC02: 404 when the entry does not belong to one of the project's repositories. */
    @Transactional(readOnly = true)
    public GitSyncHistoryDetail detail(Long projectId, GitSyncHistorySource source, Long id) {
        RepositoryActivityQueryService.ProjectRepositories scope = scope(projectId);
        if (scope.isEmpty()) throw GitIntegrationException.syncHistoryNotFound();
        GitSyncHistoryRepository.Row row = history.one(scope.ids(), source, id)
                .orElseThrow(GitIntegrationException::syncHistoryNotFound);
        GitSyncHistoryItem item = item(row, scope);
        return source == GitSyncHistorySource.JOB ? jobDetail(projectId, item, row, scope) : webhookDetail(item, row, scope);
    }

    /** Checks BR5 and returns the project's repositories. */
    private RepositoryActivityQueryService.ProjectRepositories scope(Long projectId) {
        User user = access.requireUser();
        RepositoryActivityQueryService.ProjectRepositories scope = activity.repositoriesFor(projectId); // may view the project
        policy.requireCanManage(user, scope.master());
        return scope;
    }

    private GitSyncHistoryItem item(GitSyncHistoryRepository.Row row, RepositoryActivityQueryService.ProjectRepositories scope) {
        GitRepositoryLabel label = scope.label(row.repositoryId());
        Long duration = row.startedAt() == null || row.finishedAt() == null || row.finishedAt().isBefore(row.startedAt()) ? null
                : Duration.between(row.startedAt(), row.finishedAt()).toMillis();
        if (row.source() == GitSyncHistorySource.JOB) {
            GitSyncJobStatus raw = GitSyncJobStatus.valueOf(row.rawStatus());
            GitSyncHistoryStatus status = GitSyncHistoryStatus.ofJob(raw, row.attempts());
            Map<String, Object> stats = stats(row.statsJson());
            Integer records = stats.isEmpty() && raw.inProgress() ? null : (int) records(stats);
            return new GitSyncHistoryItem(GitSyncHistorySource.JOB, row.id(), label,
                    GitSyncHistoryType.of(GitSyncJobType.valueOf(row.rawType())), status, row.rawStatus(),
                    row.occurredAt(), row.startedAt(), row.finishedAt(), duration, records, row.attempts(),
                    status == GitSyncHistoryStatus.SUCCESS ? null : row.errorCode(), null, null, null,
                    status == GitSyncHistoryStatus.PROCESSING && raw == GitSyncJobStatus.PENDING ? row.nextRunAt() : null,
                    false);
        }
        GitWebhookEventStatus raw = GitWebhookEventStatus.valueOf(row.rawStatus());
        GitSyncHistoryStatus status = GitSyncHistoryStatus.ofWebhook(raw, row.partial());
        boolean failing = raw == GitWebhookEventStatus.FAILED || raw == GitWebhookEventStatus.FAILED_RETRYABLE;
        return new GitSyncHistoryItem(GitSyncHistorySource.WEBHOOK, row.id(), label, GitSyncHistoryType.WEBHOOK, status,
                row.rawStatus(), row.occurredAt(), row.startedAt(), row.finishedAt(), duration, row.recordsProcessed(),
                Math.max(row.attempts(), 0), null, failing ? firstLine(row.error()) : null, row.rawType(), row.action(),
                raw == GitWebhookEventStatus.FAILED_RETRYABLE ? row.nextRunAt() : null,
                retryBlockedReason(row, scope) == null && raw == GitWebhookEventStatus.FAILED);
    }

    private GitSyncHistoryDetail jobDetail(Long projectId, GitSyncHistoryItem item, GitSyncHistoryRepository.Row row,
                                           RepositoryActivityQueryService.ProjectRepositories scope) {
        GitSyncJob job = jobs.findById(row.id()).orElseThrow(GitIntegrationException::syncHistoryNotFound);
        Map<String, Object> stats = stats(job.getStatsJson());
        GitSyncHistoryDetail.Breakdown breakdown = stats.isEmpty() ? null : new GitSyncHistoryDetail.Breakdown(
                value(stats, "commitsInserted"), value(stats, "commitsExisting"), value(stats, "pullRequestsInserted"),
                value(stats, "pullRequestsUpdated"), value(stats, "pullRequestsUnchanged"), value(stats, "reviewsInserted"),
                value(stats, "reviewsUpdated"));
        GitSyncHistoryDetail.ErrorInfo error = item.errorCode() == null && job.getErrorMessage() == null
                || item.status() == GitSyncHistoryStatus.SUCCESS ? null
                : new GitSyncHistoryDetail.ErrorInfo(job.getErrorCode(), job.getErrorMessage());
        ProjectRepositoryView.UserRef requestedBy = job.getRequestedByUserId() == null ? null
                : users.findById(job.getRequestedByUserId())
                .map(user -> new ProjectRepositoryView.UserRef(user.getId(), user.getFullName()))
                .orElse(new ProjectRepositoryView.UserRef(job.getRequestedByUserId(), null));
        GitRepository repository = scope.byId().get(job.getRepositoryId());
        boolean stopped = item.status() == GitSyncHistoryStatus.FAILED || item.status() == GitSyncHistoryStatus.PARTIAL_SUCCESS;
        boolean latest = jobs.findFirstByRepository_IdOrderByIdDesc(job.getRepositoryId())
                .map(newest -> newest.getId().equals(job.getId())).orElse(false);
        // "Sync again" (POST /repository/sync) for the latest stopped synchronization of the current
        // repository, from the master project (a module never synchronizes, GI-05 AC05).
        boolean canSyncAgain = stopped && latest && repository != null && scope.current() != null
                && scope.current().getId().equals(repository.getId()) && repository.getStatus().receivesEvents()
                && scope.master().getId().equals(projectId);
        return new GitSyncHistoryDetail(item, breakdown, error, null,
                new GitSyncHistoryDetail.JobInfo(job.effectivePhase(), job.getResumedFromJobId(), requestedBy,
                        job.getMaxAttempts(), canSyncAgain),
                null);
    }

    private GitSyncHistoryDetail webhookDetail(GitSyncHistoryItem item, GitSyncHistoryRepository.Row row,
                                               RepositoryActivityQueryService.ProjectRepositories scope) {
        GitWebhookEvent event = events.findById(row.id()).orElseThrow(GitIntegrationException::syncHistoryNotFound);
        boolean failing = event.getStatus() == GitWebhookEventStatus.FAILED || event.getStatus() == GitWebhookEventStatus.FAILED_RETRYABLE;
        // last_error holds the error of a failed delivery, and what a processed one did otherwise (SY-03).
        GitSyncHistoryDetail.ErrorInfo error = failing ? new GitSyncHistoryDetail.ErrorInfo(null, event.getLastError()) : null;
        String note = !failing && event.getStatus() == GitWebhookEventStatus.PROCESSED ? event.getLastError() : null;
        String blocked = event.getStatus() == GitWebhookEventStatus.FAILED ? retryBlockedReason(row, scope) : null;
        return new GitSyncHistoryDetail(item, null, error, note, null,
                new GitSyncHistoryDetail.WebhookInfo(event.getDeliveryId(), event.getSenderLogin(),
                        properties.getWebhookMaxRetries(), event.getReceivedAt(), event.getPayload() != null, blocked));
    }

    /** Why a failed delivery cannot be processed again; null when it can. */
    static String retryBlockedReason(GitSyncHistoryRepository.Row row, RepositoryActivityQueryService.ProjectRepositories scope) {
        if (!row.payloadAvailable()) return "PAYLOAD_PURGED";
        GitRepository repository = scope.byId().get(row.repositoryId());
        if (repository == null || !repository.getStatus().receivesEvents()) return "REPOSITORY_NOT_RECEIVING";
        return null;
    }

    /** Commits, pull requests and reviews a job processed (stored or already there). */
    static long records(Map<String, Object> stats) {
        return number(stats, "commitsInserted") + number(stats, "commitsExisting")
                + number(stats, "pullRequestsInserted") + number(stats, "pullRequestsUpdated") + number(stats, "pullRequestsUnchanged")
                + number(stats, "reviewsInserted") + number(stats, "reviewsUpdated");
    }

    private static long number(Map<String, Object> stats, String key) {
        return stats.get(key) instanceof Number value ? value.longValue() : 0;
    }

    private static Long value(Map<String, Object> stats, String key) {
        return stats.get(key) instanceof Number value ? value.longValue() : null;
    }

    private static String firstLine(String text) {
        if (text == null || text.isBlank()) return null;
        String line = text.strip().lines().findFirst().orElse("");
        return line.length() > ERROR_LINE ? line.substring(0, ERROR_LINE - 1) + "…" : line;
    }

    private Map<String, Object> stats(String statsJson) {
        if (statsJson == null || statsJson.isBlank()) return Map.of();
        try {
            return json.readValue(statsJson, new TypeReference<Map<String, Object>>() { });
        } catch (JsonProcessingException e) {
            return Map.of();
        }
    }
}
