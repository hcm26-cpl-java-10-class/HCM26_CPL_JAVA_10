package com.example.starter_project_2025.system.project.developmentinsights.service;

import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommit;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommitValidationResult;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommitValidationStatus;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRuleType;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRule;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitDevelopmentRuleRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitCommitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitCommitValidationResultRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.TaskGitLinkRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Latest-per-commit compliance read model, scoped through the existing Workspace Project access. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GitComplianceService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private final GitActivityScopeService scopes;
    private final GitRepositoryRepository repositories;
    private final GitCommitRepository commits;
    private final GitCommitValidationResultRepository results;
    private final TaskGitLinkRepository links;
    private final GitDevelopmentRuleRepository rules;

    public boolean hasEnabledRule(Long workspaceId) {
        GitActivityScope scope = scopes.require(workspaceId);
        return latestRules(scope.rootProjectId()).values().stream().anyMatch(GitDevelopmentRule::isEnabled);
    }

    public ComplianceReport report(Long workspaceId, Long developerId, GitDevelopmentRuleType ruleType,
                                   GitCommitValidationStatus status, LocalDate from, LocalDate to,
                                   String search, boolean failedOnly, int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid page or page size");
        if (from != null && to != null && from.isAfter(to)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Start date must not be after end date");
        GitActivityScope scope = scopes.require(workspaceId);
        Set<GitDevelopmentRuleType> enabledTypes = latestRules(scope.rootProjectId()).values().stream()
                .filter(GitDevelopmentRule::isEnabled).map(GitDevelopmentRule::getType).collect(Collectors.toSet());
        var rootRepositories = repositories.findAllByRootProject_IdOrderByIdAsc(scope.rootProjectId());
        boolean hasRealRepository = rootRepositories.stream().anyMatch(repo -> !repo.isMockData());
        Set<Long> repositoryIds = rootRepositories.stream()
                .filter(repo -> !repo.isMockData() || !hasRealRepository)
                .map(repo -> repo.getId()).collect(Collectors.toSet());
        List<GitCommit> source = repositoryIds.isEmpty() ? List.of()
                : commits.findAllByRepository_IdInOrderByCommittedAtAscIdAsc(repositoryIds);
        List<ComplianceRow> visible = new ArrayList<>();
        String query = search == null || search.isBlank() ? null : search.trim().toLowerCase(java.util.Locale.ROOT);
        Instant fromTime = from == null ? null : from.atStartOfDay(BUSINESS_ZONE).toInstant();
        Instant untilTime = to == null ? null : to.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant();
        for (GitCommit commit : source) {
            List<Long> taskProjectIds = links.findAllByCommit_IdOrderByTask_IdAsc(commit.getId()).stream()
                    .map(link -> link.getTask().getProjectId()).filter(Objects::nonNull).distinct().toList();
            boolean hasAnyLink = !taskProjectIds.isEmpty();
            boolean inScope = scope.rootScope() || taskProjectIds.stream().anyMatch(scope.projectIds()::contains)
                    || (!hasAnyLink && commit.getAuthorContributor() != null
                    && scope.contributorIds().contains(commit.getAuthorContributor().getId()));
            if (!inScope || commit.getAuthorContributor() == null && developerId != null) continue;
            if (developerId != null && (commit.getAuthorContributor().getUser() == null
                    || !Objects.equals(commit.getAuthorContributor().getUser().getId(), developerId))) continue;
            if (fromTime != null && commit.getCommittedAt().isBefore(fromTime)) continue;
            if (untilTime != null && !commit.getCommittedAt().isBefore(untilTime)) continue;
            if (query != null && !commit.getMessage().toLowerCase(java.util.Locale.ROOT).contains(query)
                    && !commit.getSha().toLowerCase(java.util.Locale.ROOT).contains(query)
                    && !(commit.getAuthorContributor() == null ? "unknown contributor" : commit.getAuthorContributor().label())
                    .toLowerCase(java.util.Locale.ROOT).contains(query)) continue;

            Map<GitDevelopmentRuleType, GitCommitValidationResult> latest = new java.util.EnumMap<>(GitDevelopmentRuleType.class);
            for (GitCommitValidationResult result : results.findAllByCommit_IdOrderByEvaluatedAtDescIdDesc(commit.getId())) {
                latest.putIfAbsent(result.getType(), result);
            }
            List<GitCommitValidationResult> selected = latest.values().stream()
                    .filter(result -> enabledTypes.contains(result.getType()))
                    .filter(result -> ruleType == null || result.getType() == ruleType)
                    .filter(result -> status == null || result.getStatus() == status)
                    .filter(result -> !failedOnly || isViolation(result.getStatus())).toList();
            for (GitCommitValidationResult result : selected) {
                visible.add(new ComplianceRow(commit.getId(), commit.getSha(), commit.getMessage(),
                        commit.getAuthorContributor() == null ? "Unknown contributor" : commit.getAuthorContributor().label(),
                        commit.getAuthorContributor() == null || commit.getAuthorContributor().getUser() == null
                        ? null : commit.getAuthorContributor().getUser().getId(), commit.getCommittedAt(),
                        result.getType(), result.getRuleVersion(), result.getStatus(), result.getReason(),
                        visibleDetails(result, scope), result.getEvaluatedAt()));
            }
        }
        visible.sort(Comparator.comparing(ComplianceRow::evaluatedAt, Comparator.reverseOrder())
                .thenComparing(ComplianceRow::commitId, Comparator.reverseOrder()));
        long evaluatedCommits = visible.stream().map(ComplianceRow::commitId).distinct().count();
        Map<GitDevelopmentRuleType, RuleSummary> summary = new java.util.EnumMap<>(GitDevelopmentRuleType.class);
        for (GitDevelopmentRuleType type : GitDevelopmentRuleType.values()) {
            List<ComplianceRow> rows = visible.stream().filter(row -> row.ruleType() == type).toList();
            summary.put(type, new RuleSummary(rows.size(), count(rows, GitCommitValidationStatus.PASSED),
                    count(rows, GitCommitValidationStatus.FAILED), count(rows, GitCommitValidationStatus.MISSING),
                    count(rows, GitCommitValidationStatus.INVALID), count(rows, GitCommitValidationStatus.OUTSIDE_PROJECT)));
        }
        List<ComplianceRow> violations = visible.stream().filter(row -> isViolation(row.status())).toList();
        int start = Math.min(page * size, visible.size());
        int end = Math.min(start + size, visible.size());
        return new ComplianceReport(evaluatedCommits, summary,
                new PageImpl<>(visible.subList(start, end), PageRequest.of(page, size), visible.size()),
                violations.size());
    }

    private static boolean isViolation(GitCommitValidationStatus status) {
        return status == GitCommitValidationStatus.FAILED || status == GitCommitValidationStatus.MISSING
                || status == GitCommitValidationStatus.INVALID || status == GitCommitValidationStatus.OUTSIDE_PROJECT;
    }

    private static String visibleDetails(GitCommitValidationResult result, GitActivityScope scope) {
        String details = result.getDetails();
        if (details == null || details.isBlank() || result.getType() != GitDevelopmentRuleType.TASK_ID) return details;
        if (!scope.canReadTasks()) return null;
        return details.lines().filter(line -> {
            java.util.regex.Matcher project = java.util.regex.Pattern.compile("project_id=(\\d+)").matcher(line);
            return !project.find() || scope.projectIds().contains(Long.parseLong(project.group(1)));
        }).collect(Collectors.joining("\n"));
    }

    private Map<GitDevelopmentRuleType, GitDevelopmentRule> latestRules(Long rootId) {
        Map<GitDevelopmentRuleType, GitDevelopmentRule> latest = new java.util.EnumMap<>(GitDevelopmentRuleType.class);
        rules.findAllByRootProject_IdOrderByTypeAscVersionDesc(rootId)
                .forEach(rule -> latest.putIfAbsent(rule.getType(), rule));
        return latest;
    }

    private static long count(List<ComplianceRow> rows, GitCommitValidationStatus status) {
        return rows.stream().filter(row -> row.status() == status).count();
    }

    public record RuleSummary(long evaluated, long passed, long failed, long missing, long invalid, long outsideProject) { }
    public record ComplianceRow(Long commitId, String sha, String message, String developerName, Long developerId,
                                Instant committedAt, GitDevelopmentRuleType ruleType, int ruleVersion,
                                GitCommitValidationStatus status, String reason, String details, Instant evaluatedAt) { }
    public record ComplianceReport(long evaluatedCommits, Map<GitDevelopmentRuleType, RuleSummary> byRule,
                                   Page<ComplianceRow> results, long violationCount) { }
}
