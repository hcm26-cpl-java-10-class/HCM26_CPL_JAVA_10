package com.example.starter_project_2025.system.project.developmentinsights.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommit;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommitValidationResult;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommitValidationStatus;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRule;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRuleType;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.domain.TaskGitLink;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitCommitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitCommitValidationResultRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitDevelopmentRuleRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.TaskGitLinkRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class GitComplianceServiceTest {
    private GitActivityScopeService scopes;
    private GitRepositoryRepository repositories;
    private GitCommitRepository commits;
    private GitCommitValidationResultRepository results;
    private TaskGitLinkRepository links;
    private GitDevelopmentRuleRepository rules;
    private GitComplianceService service;
    private Project root;
    private GitCommit commit;
    private GitCommitValidationResult result;

    @BeforeEach
    void setUp() {
        scopes = mock(GitActivityScopeService.class);
        repositories = mock(GitRepositoryRepository.class);
        commits = mock(GitCommitRepository.class);
        results = mock(GitCommitValidationResultRepository.class);
        links = mock(TaskGitLinkRepository.class);
        rules = mock(GitDevelopmentRuleRepository.class);
        service = new GitComplianceService(scopes, repositories, commits, results, links, rules);

        root = mock(Project.class);
        when(root.getId()).thenReturn(10L);
        GitDevelopmentRule rule = GitDevelopmentRule.configure(root, GitDevelopmentRuleType.TASK_ID, 1,
                true, "feat,fix", false, "(?i)\\bFA-\\d+\\b", null, Instant.parse("2026-11-20T00:00:00Z"));
        when(rules.findAllByRootProject_IdOrderByTypeAscVersionDesc(10L)).thenReturn(List.of(rule));

        GitRepository repository = mock(GitRepository.class);
        when(repository.getId()).thenReturn(4L);
        when(repository.isMockData()).thenReturn(false);
        when(repositories.findAllByRootProject_IdOrderByIdAsc(10L)).thenReturn(List.of(repository));

        commit = mock(GitCommit.class);
        when(commit.getId()).thenReturn(50L);
        when(commit.getSha()).thenReturn("0123456789abcdef");
        when(commit.getMessage()).thenReturn("fix(task): update references");
        when(commit.getCommittedAt()).thenReturn(Instant.parse("2026-11-19T10:00:00Z"));
        when(commits.findAllByRepository_IdInOrderByCommittedAtAscIdAsc(anyCollection())).thenReturn(List.of(commit));

        SprintBacklog task = mock(SprintBacklog.class);
        when(task.getProjectId()).thenReturn(11L);
        TaskGitLink taskLink = mock(TaskGitLink.class);
        when(taskLink.getTask()).thenReturn(task);
        when(links.findAllByCommit_IdOrderByTask_IdAsc(50L)).thenReturn(List.of(taskLink));

        result = mock(GitCommitValidationResult.class);
        when(result.getType()).thenReturn(GitDevelopmentRuleType.TASK_ID);
        when(result.getStatus()).thenReturn(GitCommitValidationStatus.MISSING);
        when(result.getRuleVersion()).thenReturn(1);
        when(result.getReason()).thenReturn("One or more Task Keys are missing.");
        when(result.getDetails()).thenReturn("FA-31 → sprint_backlog_id=31, project_id=11, valid.\n"
                + "OP-45 → sprint_backlog_id=45, project_id=12, outside.");
        when(result.getEvaluatedAt()).thenReturn(Instant.parse("2026-11-19T11:00:00Z"));
        when(results.findAllByCommit_IdOrderByEvaluatedAtDescIdDesc(50L)).thenReturn(List.of(result));
    }

    @Test
    void summaryUsesOnlyEvaluatedResultsAndHidesTaskReferencesOutsideModuleScope() {
        when(scopes.require(3L)).thenReturn(scope(true));

        var report = service.report(3L, null, null, null, null, null, null, false, 0, 20);

        assertThat(report.evaluatedCommits()).isEqualTo(1);
        assertThat(report.violationCount()).isEqualTo(1);
        assertThat(report.byRule().get(GitDevelopmentRuleType.TASK_ID).missing()).isEqualTo(1);
        assertThat(report.results().getContent()).singleElement().satisfies(row -> {
            assertThat(row.details()).contains("project_id=11");
            assertThat(row.details()).doesNotContain("project_id=12", "sprint_backlog_id=45");
        });
    }

    @Test
    void taskDetailsAreOmittedWhenWorkspaceDoesNotGrantTaskRead() {
        when(scopes.require(3L)).thenReturn(scope(false));

        var report = service.report(3L, null, null, null, null, null, null, false, 0, 20);

        assertThat(report.results().getContent()).singleElement()
                .satisfies(row -> assertThat(row.details()).isNull());
    }

    @Test
    void noValidationResultsAreEmptyAndNeverCountedAsPassed() {
        when(scopes.require(3L)).thenReturn(scope(true));
        when(results.findAllByCommit_IdOrderByEvaluatedAtDescIdDesc(50L)).thenReturn(List.of());

        var report = service.report(3L, null, null, null, null, null, null, false, 0, 20);

        assertThat(report.evaluatedCommits()).isZero();
        assertThat(report.byRule().get(GitDevelopmentRuleType.TASK_ID).passed()).isZero();
        assertThat(report.results().getTotalElements()).isZero();
    }

    @Test
    void overviewCountsLatestPassedAndFailedResultsPerRuleAndDistinctCommit() {
        GitDevelopmentRule conventional = GitDevelopmentRule.configure(root,
                GitDevelopmentRuleType.CONVENTIONAL_COMMIT, 1, true, "feat,fix", false,
                null, null, Instant.parse("2026-11-20T00:00:00Z"));
        GitDevelopmentRule taskIdRule = GitDevelopmentRule.configure(root, GitDevelopmentRuleType.TASK_ID, 1, true,
                "feat,fix", false, "(?i)\\bFA-\\d+\\b", null,
                Instant.parse("2026-11-20T00:00:00Z"));
        when(rules.findAllByRootProject_IdOrderByTypeAscVersionDesc(10L)).thenReturn(List.of(conventional, taskIdRule));

        GitCommitValidationResult passed = mock(GitCommitValidationResult.class);
        when(passed.getType()).thenReturn(GitDevelopmentRuleType.CONVENTIONAL_COMMIT);
        when(passed.getStatus()).thenReturn(GitCommitValidationStatus.PASSED);
        when(passed.getRuleVersion()).thenReturn(1);
        when(passed.getReason()).thenReturn("Commit message follows the convention.");
        when(passed.getEvaluatedAt()).thenReturn(Instant.parse("2026-11-19T12:00:00Z"));
        when(results.findAllByCommit_IdOrderByEvaluatedAtDescIdDesc(50L)).thenReturn(List.of(passed, result));

        GitCommit secondCommit = mock(GitCommit.class);
        when(secondCommit.getId()).thenReturn(51L);
        when(secondCommit.getSha()).thenReturn("fedcba9876543210");
        when(secondCommit.getMessage()).thenReturn("broken commit message");
        when(secondCommit.getCommittedAt()).thenReturn(Instant.parse("2026-11-19T13:00:00Z"));
        GitRepository sourceRepository = commit.getRepository();
        when(secondCommit.getRepository()).thenReturn(sourceRepository);
        when(commits.findAllByRepository_IdInOrderByCommittedAtAscIdAsc(anyCollection()))
                .thenReturn(List.of(commit, secondCommit));
        when(scopes.require(3L)).thenReturn(new GitActivityScope(null, 10L, Set.of(10L), true,
                Set.of(), Map.of(), true));

        GitCommitValidationResult failed = mock(GitCommitValidationResult.class);
        when(failed.getType()).thenReturn(GitDevelopmentRuleType.CONVENTIONAL_COMMIT);
        when(failed.getStatus()).thenReturn(GitCommitValidationStatus.FAILED);
        when(failed.getRuleVersion()).thenReturn(1);
        when(failed.getReason()).thenReturn("Commit type is not allowed.");
        when(failed.getEvaluatedAt()).thenReturn(Instant.parse("2026-11-19T14:00:00Z"));
        when(results.findAllByCommit_IdOrderByEvaluatedAtDescIdDesc(51L)).thenReturn(List.of(failed));

        var report = service.report(3L, null, null, null, null, null, null, false, 0, 20);

        assertThat(report.evaluatedCommits()).isEqualTo(2);
        assertThat(report.byRule().get(GitDevelopmentRuleType.CONVENTIONAL_COMMIT).passed()).isEqualTo(1);
        assertThat(report.byRule().get(GitDevelopmentRuleType.CONVENTIONAL_COMMIT).failed()).isEqualTo(1);
        assertThat(report.byRule().get(GitDevelopmentRuleType.TASK_ID).missing()).isEqualTo(1);
        assertThat(report.results().getTotalElements()).isEqualTo(3);
        assertThat(report.violationCount()).isEqualTo(2);
    }

    private static GitActivityScope scope(boolean canReadTasks) {
        return new GitActivityScope(null, 10L, Set.of(11L), false, Set.of(), Map.of(), canReadTasks);
    }
}
