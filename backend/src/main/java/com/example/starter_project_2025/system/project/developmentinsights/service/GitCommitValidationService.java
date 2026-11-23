package com.example.starter_project_2025.system.project.developmentinsights.service;

import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommit;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommitValidationResult;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommitValidationTaskReference;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommitValidationStatus;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRule;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRuleType;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitCommitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitCommitValidationResultRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitCommitValidationTaskReferenceRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitDevelopmentRuleRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Evaluates immutable Git commit snapshots against the latest enabled root-project rules. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GitCommitValidationService {
    private final GitActivityScopeService scopes;
    private final GitDevelopmentRuleService manager;
    private final GitDevelopmentRuleRepository rules;
    private final GitCommitRepository commits;
    private final GitCommitValidationResultRepository results;
    private final GitCommitValidationTaskReferenceRepository taskReferenceResults;
    private final GitTaskReferenceResolver taskReferences;
    private final GitRepositoryRepository repositories;
    private final SprintBacklogRepository taskRepository;
    private final ProjectRepository projectRepository;

    /** Dev A calls this after an idempotent commit upsert; retries reuse the same (commit, rule version) result. */
    @Transactional
    public List<GitCommitValidationResult> validateSyncedCommit(GitCommit commit) {
        if (commit == null || commit.getId() == null || commit.getRepository() == null
                || commit.getRepository().getRootProject() == null) return List.of();
        Long rootId = commit.getRepository().getRootProject().getId();
        return evaluate(commit, rootId);
    }

    @Transactional
    public List<ValidationView> validateWorkspaceCommit(Long workspaceId, Long commitId) {
        GitActivityScope scope = scopes.require(workspaceId);
        if (!manager.canManage(workspaceId)) {
            throw new AccessDeniedException("Only an authorized root Project Manager can run development validation");
        }
        GitCommit commit = commits.findById(commitId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commit was not found"));
        if (!Objects.equals(commit.getRepository().getRootProject().getId(), scope.rootProjectId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Commit was not found in this Workspace");
        }
        return evaluate(commit, scope.rootProjectId()).stream().map(GitCommitValidationService::view).toList();
    }

    @Transactional
    public List<ValidationView> validateLatestWorkspaceCommits(Long workspaceId) {
        GitActivityScope scope = scopes.require(workspaceId);
        if (!manager.canManage(workspaceId)) {
            throw new AccessDeniedException("Only an authorized root Project Manager can run development validation");
        }
        // The explicit fixture action simulates an inbound sync for all known commits. The real ingestor calls
        // validateSyncedCommit only for the commit it has just upserted.
        List<Long> repositoryIds = repositories.findAllByRootProject_IdOrderByIdAsc(scope.rootProjectId()).stream()
                .map(repository -> repository.getId()).toList();
        List<GitCommit> source = repositoryIds.isEmpty() ? List.of()
                : commits.findAllByRepository_IdInOrderByCommittedAtAscIdAsc(repositoryIds);
        return source.stream().flatMap(commit -> evaluate(commit, scope.rootProjectId()).stream())
                .map(GitCommitValidationService::view).toList();
    }

    private List<GitCommitValidationResult> evaluate(GitCommit commit, Long rootId) {
        List<GitCommitValidationResult> evaluated = new ArrayList<>();
        java.util.Map<GitDevelopmentRuleType, GitDevelopmentRule> latest = new java.util.EnumMap<>(GitDevelopmentRuleType.class);
        rules.findAllByRootProject_IdOrderByTypeAscVersionDesc(rootId).stream()
                .forEach(rule -> latest.putIfAbsent(rule.getType(), rule));
        for (GitDevelopmentRule rule : latest.values().stream().filter(GitDevelopmentRule::isEnabled).toList()) {
            var previous = results.findFirstByCommit_IdAndTypeAndRuleVersion(commit.getId(), rule.getType(), rule.getVersion());
            if (previous.isPresent()) {
                evaluated.add(previous.get());
                continue;
            }
            Evaluation outcome = evaluate(commit, rule);
            GitCommitValidationResult result = results.saveAndFlush(GitCommitValidationResult.record(commit,
                    rule.getType(), rule.getVersion(), outcome.status(), outcome.reason(), outcome.details(), Instant.now()));
            if (!outcome.taskReferences().isEmpty()) {
                var resolved = outcome.taskReferences().stream()
                        .filter(reference -> reference.taskId() != null && reference.projectId() != null)
                        .collect(java.util.stream.Collectors.toMap(GitTaskReferenceResolver.KeyResolution::taskId,
                                reference -> GitCommitValidationTaskReference.link(result,
                                        taskRepository.getReferenceById(reference.taskId()),
                                        projectRepository.getReferenceById(reference.projectId())),
                                (first, ignored) -> first, java.util.LinkedHashMap::new));
                if (!resolved.isEmpty()) taskReferenceResults.saveAll(resolved.values());
            }
            evaluated.add(result);
        }
        return evaluated;
    }

    private Evaluation evaluate(GitCommit commit, GitDevelopmentRule rule) {
        return rule.getType() == GitDevelopmentRuleType.CONVENTIONAL_COMMIT
                ? conventional(commit, rule) : taskReferences(commit, rule);
    }

    private Evaluation conventional(GitCommit commit, GitDevelopmentRule rule) {
        String firstLine = commit.getMessage() == null ? "" : commit.getMessage().lines().findFirst().orElse("").trim();
        Matcher matcher = Pattern.compile("^([a-z]+)(?:\\(([^()]+)\\))?(!)?:\\s+\\S.*$",
                Pattern.CASE_INSENSITIVE).matcher(firstLine);
        if (!matcher.matches()) return new Evaluation(GitCommitValidationStatus.FAILED,
                "Expected type(scope): description.", firstLine);
        String type = matcher.group(1).toLowerCase(Locale.ROOT);
        List<String> allowed = rule.getAllowedCommitTypes() == null ? List.of()
                : List.of(rule.getAllowedCommitTypes().split(","));
        if (!allowed.contains(type)) return new Evaluation(GitCommitValidationStatus.FAILED,
                "Commit type '" + type + "' is not enabled for this Project.", firstLine);
        if (rule.isScopeRequired() && (matcher.group(2) == null || matcher.group(2).isBlank())) {
            return new Evaluation(GitCommitValidationStatus.FAILED, "A scope is required by the current rule.", firstLine);
        }
        return new Evaluation(GitCommitValidationStatus.PASSED, "Commit message matches the configured convention.", firstLine);
    }

    private Evaluation taskReferences(GitCommit commit, GitDevelopmentRule rule) {
        var resolution = taskReferences.resolve(commit.getRepository().getRootProject().getId(),
                commit.getMessage(), rule.getTaskKeyPattern());
        return new Evaluation(resolution.status(), resolution.reason(), resolution.details(), resolution.references());
    }

    private static ValidationView view(GitCommitValidationResult result) {
        return new ValidationView(result.getId(), result.getCommit().getId(), result.getType(), result.getRuleVersion(),
                result.getStatus(), result.getReason(), result.getDetails(), result.getEvaluatedAt());
    }

    public record ValidationView(Long id, Long commitId, GitDevelopmentRuleType type, int ruleVersion,
                                 GitCommitValidationStatus status, String reason, String details,
                                 Instant evaluatedAt) { }
    private record Evaluation(GitCommitValidationStatus status, String reason, String details,
                              List<GitTaskReferenceResolver.KeyResolution> taskReferences) {
        private Evaluation(GitCommitValidationStatus status, String reason, String details) {
            this(status, reason, details, List.of());
        }
    }
}
