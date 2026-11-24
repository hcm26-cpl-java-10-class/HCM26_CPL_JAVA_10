package com.example.starter_project_2025.system.project.developmentinsights.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommit;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommitValidationResult;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommitValidationStatus;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRule;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRuleType;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitCommitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitCommitValidationResultRepository;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommitValidationTaskReference;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitCommitValidationTaskReferenceRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitDevelopmentRuleRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.TaskGitLinkRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class GitCommitValidationServiceTest {
    private GitActivityScopeService scopes;
    private GitDevelopmentRuleService manager;
    private GitDevelopmentRuleRepository rules;
    private GitCommitRepository commits;
    private GitCommitValidationResultRepository results;
    private GitCommitValidationTaskReferenceRepository taskReferenceResults;
    private GitTaskReferenceResolver taskReferences;
    private GitRepositoryRepository repositories;
    private SprintBacklogRepository taskRepository;
    private ProjectRepository projectRepository;
    private GitCommitValidationService service;
    private Project root;
    private GitRepository repository;
    private GitCommit commit;

    @BeforeEach
    void setUp() {
        scopes = mock(GitActivityScopeService.class);
        manager = mock(GitDevelopmentRuleService.class);
        rules = mock(GitDevelopmentRuleRepository.class);
        commits = mock(GitCommitRepository.class);
        results = mock(GitCommitValidationResultRepository.class);
        taskReferenceResults = mock(GitCommitValidationTaskReferenceRepository.class);
        taskReferences = mock(GitTaskReferenceResolver.class);
        repositories = mock(GitRepositoryRepository.class);
        taskRepository = mock(SprintBacklogRepository.class);
        projectRepository = mock(ProjectRepository.class);
        when(taskRepository.getReferenceById(31L)).thenReturn(mock(com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog.class));
        Project rootReference = rootProjectReference(10L);
        when(projectRepository.getReferenceById(10L)).thenReturn(rootReference);
        service = new GitCommitValidationService(scopes, manager, rules, commits, results, taskReferenceResults,
                taskReferences, repositories, taskRepository, projectRepository,
                mock(com.example.starter_project_2025.system.project.developmentinsights.repository.GitValidationRunRepository.class));
        root = mock(Project.class);
        when(root.getId()).thenReturn(10L);
        when(root.getTenantId()).thenReturn(7L);
        repository = mock(GitRepository.class);
        when(repository.getRootProject()).thenReturn(root);
        commit = mock(GitCommit.class);
        when(commit.getId()).thenReturn(22L);
        when(commit.getRepository()).thenReturn(repository);
        when(rules.findAllByRootProject_IdOrderByTypeAscVersionDesc(10L)).thenReturn(List.of());
        when(results.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void validatesConventionalMessageAndReusesSameVersionOnRetry() {
        GitDevelopmentRule rule = rule(GitDevelopmentRuleType.CONVENTIONAL_COMMIT, 1, true,
                "feat,fix,docs,refactor,test,chore", false, "(?i)\\bFA-\\d+\\b");
        when(rules.findAllByRootProject_IdOrderByTypeAscVersionDesc(10L)).thenReturn(List.of(rule));
        when(commit.getMessage()).thenReturn("feat(workspace): add useful activity");
        when(results.findFirstByCommit_IdAndTypeAndRuleVersion(22L, GitDevelopmentRuleType.CONVENTIONAL_COMMIT, 1))
                .thenReturn(Optional.empty());

        var first = service.validateSyncedCommit(commit);
        assertThat(first).singleElement().satisfies(result -> assertThat(result.getStatus()).isEqualTo(GitCommitValidationStatus.PASSED));

        when(results.findFirstByCommit_IdAndTypeAndRuleVersion(22L, GitDevelopmentRuleType.CONVENTIONAL_COMMIT, 1))
                .thenReturn(Optional.of(first.get(0)));
        var retry = service.validateSyncedCommit(commit);

        assertThat(retry).containsExactly(first.get(0));
        verify(results).saveAndFlush(any(GitCommitValidationResult.class));
    }

    @Test
    void conventionFailureKeepsReasonAndDoesNotChangeCommitMessage() {
        GitDevelopmentRule rule = rule(GitDevelopmentRuleType.CONVENTIONAL_COMMIT, 1, true, "feat,fix", true,
                "(?i)\\bFA-\\d+\\b");
        when(rules.findAllByRootProject_IdOrderByTypeAscVersionDesc(10L)).thenReturn(List.of(rule));
        when(commit.getMessage()).thenReturn("feature: without an allowed type");
        when(results.findFirstByCommit_IdAndTypeAndRuleVersion(22L, GitDevelopmentRuleType.CONVENTIONAL_COMMIT, 1))
                .thenReturn(Optional.empty());

        var result = service.validateSyncedCommit(commit).get(0);

        assertThat(result.getStatus()).isEqualTo(GitCommitValidationStatus.FAILED);
        assertThat(result.getReason()).contains("not enabled");
        verify(commit, never()).setMessage(any());
    }

    @Test
    void customCommitTypePassesUntilRemovedAndKeepsThePreviousValidation() {
        var enabled = rule(GitDevelopmentRuleType.CONVENTIONAL_COMMIT, 1, true,
                "feat,release-2", false, "(?i)\\bFA-\\d+\\b");
        var removed = rule(GitDevelopmentRuleType.CONVENTIONAL_COMMIT, 2, true,
                "feat", false, "(?i)\\bFA-\\d+\\b");
        when(commit.getMessage()).thenReturn("release-2(build): package the next release");
        when(rules.findAllByRootProject_IdOrderByTypeAscVersionDesc(10L)).thenReturn(List.of(enabled));

        var first = service.validateSyncedCommit(commit).get(0);
        assertThat(first.getStatus()).isEqualTo(GitCommitValidationStatus.PASSED);

        when(rules.findAllByRootProject_IdOrderByTypeAscVersionDesc(10L)).thenReturn(List.of(removed));
        var second = service.validateSyncedCommit(commit).get(0);

        assertThat(second.getStatus()).isEqualTo(GitCommitValidationStatus.FAILED);
        assertThat(second.getReason()).contains("not enabled");
        assertThat(second.getRuleVersion()).isEqualTo(2);
        assertThat(first.getStatus()).isEqualTo(GitCommitValidationStatus.PASSED);
        assertThat(first.getRuleVersion()).isEqualTo(1);
        verify(commit, never()).setMessage(any());
    }

    @Test
    void changedConfigurationVersionCreatesANewResultAndRetainsPreviousVersion() {
        GitDevelopmentRule versionOne = rule(GitDevelopmentRuleType.CONVENTIONAL_COMMIT, 1, true, "feat", false,
                "(?i)\\bFA-\\d+\\b");
        GitDevelopmentRule versionTwo = rule(GitDevelopmentRuleType.CONVENTIONAL_COMMIT, 2, true, "fix", false,
                "(?i)\\bFA-\\d+\\b");
        when(commit.getMessage()).thenReturn("fix(api): preserve old result");
        when(rules.findAllByRootProject_IdOrderByTypeAscVersionDesc(10L)).thenReturn(List.of(versionOne));
        when(results.findFirstByCommit_IdAndTypeAndRuleVersion(22L, GitDevelopmentRuleType.CONVENTIONAL_COMMIT, 1))
                .thenReturn(Optional.empty());
        var oldResult = service.validateSyncedCommit(commit).get(0);
        assertThat(oldResult.getStatus()).isEqualTo(GitCommitValidationStatus.FAILED);
        assertThat(oldResult.getRuleVersion()).isEqualTo(1);

        when(rules.findAllByRootProject_IdOrderByTypeAscVersionDesc(10L)).thenReturn(List.of(versionTwo));
        when(results.findFirstByCommit_IdAndTypeAndRuleVersion(22L, GitDevelopmentRuleType.CONVENTIONAL_COMMIT, 2))
                .thenReturn(Optional.empty());
        var newResult = service.validateSyncedCommit(commit).get(0);

        assertThat(newResult.getStatus()).isEqualTo(GitCommitValidationStatus.PASSED);
        assertThat(newResult.getRuleVersion()).isEqualTo(2);
        assertThat(oldResult.getStatus()).isEqualTo(GitCommitValidationStatus.FAILED);
        verify(results, org.mockito.Mockito.times(2)).saveAndFlush(any(GitCommitValidationResult.class));
    }

    @Test
    void disabledRuleIsNotEvaluated() {
        GitDevelopmentRule rule = rule(GitDevelopmentRuleType.CONVENTIONAL_COMMIT, 1, false, "feat", false,
                "(?i)\\bFA-\\d+\\b");
        when(rules.findAllByRootProject_IdOrderByTypeAscVersionDesc(10L)).thenReturn(List.of(rule));

        assertThat(service.validateSyncedCommit(commit)).isEmpty();
        verify(results, never()).saveAndFlush(any());
    }

    @Test
    void newerDisabledVersionPreventsAnOlderEnabledVersionFromRunning() {
        GitDevelopmentRule latestDisabled = rule(GitDevelopmentRuleType.CONVENTIONAL_COMMIT, 2, false,
                "feat", false, "(?i)\\bFA-\\d+\\b");
        GitDevelopmentRule olderEnabled = rule(GitDevelopmentRuleType.CONVENTIONAL_COMMIT, 1, true,
                "feat", false, "(?i)\\bFA-\\d+\\b");
        when(rules.findAllByRootProject_IdOrderByTypeAscVersionDesc(10L)).thenReturn(List.of(latestDisabled, olderEnabled));

        assertThat(service.validateSyncedCommit(commit)).isEmpty();
        verify(results, never()).saveAndFlush(any());
    }

    @Test
    void backlogKeyAndKanbanTaskIdResolveToTheSameBacklogId() {
        GitDevelopmentRule rule = rule(GitDevelopmentRuleType.TASK_ID, 1, true, "feat", false,
                "(?i)\\bFA-\\d+\\b");
        when(rules.findAllByRootProject_IdOrderByTypeAscVersionDesc(10L)).thenReturn(List.of(rule));
        when(commit.getMessage()).thenReturn("feat(task): finish FA-31 TASK-31");
        var resolution = new GitTaskReferenceResolver.Resolution(GitCommitValidationStatus.PASSED,
                "All Task Keys resolve to active Tasks in this Project root.", List.of(
                new GitTaskReferenceResolver.KeyResolution("FA-31", GitCommitValidationStatus.PASSED,
                        31L, 10L, "Task reference is valid."),
                new GitTaskReferenceResolver.KeyResolution("TASK-31", GitCommitValidationStatus.PASSED,
                        31L, 10L, "Task reference is valid.")));
        when(taskReferences.resolve(10L, "feat(task): finish FA-31 TASK-31", "(?i)\\bFA-\\d+\\b"))
                .thenReturn(resolution);
        when(results.findFirstByCommit_IdAndTypeAndRuleVersion(22L, GitDevelopmentRuleType.TASK_ID, 1))
                .thenReturn(Optional.empty());

        var result = service.validateSyncedCommit(commit).get(0);

        assertThat(result.getStatus()).isEqualTo(GitCommitValidationStatus.PASSED);
        assertThat(result.getDetails()).contains("FA-31 → sprint_backlog_id=31, project_id=10, Task reference is valid.",
                "TASK-31 → sprint_backlog_id=31, project_id=10, Task reference is valid.");
        org.mockito.ArgumentCaptor<Iterable<GitCommitValidationTaskReference>> references =
                org.mockito.ArgumentCaptor.forClass(Iterable.class);
        verify(taskReferenceResults).saveAll(references.capture());
        assertThat(references.getValue()).singleElement().satisfies(reference -> {
            assertThat(reference.getTask()).isNotNull();
            assertThat(reference.getProject()).isNotNull();
            assertThat(reference.getValidationResult()).isSameAs(result);
        });
        verify(taskReferences).resolve(10L, "feat(task): finish FA-31 TASK-31", "(?i)\\bFA-\\d+\\b");
    }

    @Test
    void disabledTaskRuleDoesNotMarkMissing() {
        GitDevelopmentRule rule = rule(GitDevelopmentRuleType.TASK_ID, 1, false, "feat", false,
                "(?i)\\bFA-\\d+\\b");
        when(rules.findAllByRootProject_IdOrderByTypeAscVersionDesc(10L)).thenReturn(List.of(rule));
        when(commit.getMessage()).thenReturn("feat: missing any key");

        assertThat(service.validateSyncedCommit(commit)).isEmpty();
        verify(taskReferences, never()).resolve(org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    private GitDevelopmentRule rule(GitDevelopmentRuleType type, int version, boolean enabled,
                                    String types, boolean scopeRequired, String pattern) {
        return GitDevelopmentRule.configure(root, type, version, enabled, types, scopeRequired, pattern, null,
                java.time.Instant.parse("2026-11-20T00:00:00Z"));
    }

    private static Project rootProjectReference(Long id) {
        Project project = mock(Project.class);
        when(project.getId()).thenReturn(id);
        return project;
    }
}
