package com.example.starter_project_2025.system.project.developmentinsights.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommitValidationStatus;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceStatus;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class GitTaskReferenceResolverTest {
    private SprintBacklogRepository tasks;
    private ProjectRepository projects;
    private WorkspaceRepository workspaces;
    private com.example.starter_project_2025.system.git_integration.tasklink.BacklogItemDirectory directory;
    private GitTaskReferenceResolver resolver;
    private Project root;

    @BeforeEach
    void setUp() {
        tasks = mock(SprintBacklogRepository.class);
        projects = mock(ProjectRepository.class);
        workspaces = mock(WorkspaceRepository.class);
        directory = mock(com.example.starter_project_2025.system.git_integration.tasklink.BacklogItemDirectory.class);
        when(directory.byKeys(org.mockito.ArgumentMatchers.eq(7L), org.mockito.ArgumentMatchers.anyCollection()))
                .thenAnswer(invocation -> {
                    java.util.Map<String, com.example.starter_project_2025.system.git_integration.repository.GitBacklogLookupRepository.BacklogItemRow> rows = new java.util.HashMap<>();
                    java.util.Collection<String> keys = invocation.getArgument(1);
                    for (String key : keys) {
                        long id;
                        try { id = Long.parseLong(key.substring(key.lastIndexOf('-') + 1)); }
                        catch (NumberFormatException ignored) { continue; }
                        if (tasks.findById(id).isEmpty()) continue;
                        var row = mock(com.example.starter_project_2025.system.git_integration.repository.GitBacklogLookupRepository.BacklogItemRow.class);
                        when(row.getId()).thenReturn(id);
                        rows.put(key, row);
                    }
                    return rows;
                });
        when(directory.prefixesOf(7L)).thenReturn(java.util.Set.of("FA", "TASK", "OTHER", "OP"));
        resolver = new GitTaskReferenceResolver(tasks, projects, workspaces, directory);
        root = project(10L, 7L, null);
        when(projects.findById(10L)).thenReturn(Optional.of(root));
        Workspace workspace = workspace("FA");
        when(workspaces.findAllByTenant_IdAndStatusAndIsActiveTrue(7L, WorkspaceStatus.ACTIVE))
                .thenReturn(java.util.List.of(workspace));
    }

    @Test
    void backlogPrefixAndKanbanTaskIdResolveToTheSameSprintBacklogIdAcrossModules() {
        Project module = project(11L, 7L, root);
        SprintBacklog item = mock(SprintBacklog.class);
        when(item.getIsActive()).thenReturn(true);
        when(item.getProjectId()).thenReturn(11L);
        when(tasks.findById(31L)).thenReturn(Optional.of(item));
        when(projects.findById(11L)).thenReturn(Optional.of(module));

        var resolution = resolver.resolve(10L, "feat(task): finish FA-31 TASK-31", "(?i)\\bFA-\\d+\\b");

        assertThat(resolution.status()).isEqualTo(GitCommitValidationStatus.PASSED);
        assertThat(resolution.references()).extracting(GitTaskReferenceResolver.KeyResolution::key)
                .containsExactly("FA-31", "TASK-31");
        assertThat(resolution.references()).extracting(GitTaskReferenceResolver.KeyResolution::taskId)
                .containsOnly(31L);
        assertThat(resolution.details()).contains("sprint_backlog_id=31", "project_id=11");
    }

    @Test
    void missingAndNonexistentTaskKeysHaveDifferentStatuses() {
        assertThat(resolver.resolve(10L, "fix: no task key", "(?i)\\bFA-\\d+\\b").status())
                .isEqualTo(GitCommitValidationStatus.MISSING);
        when(tasks.findById(999L)).thenReturn(Optional.empty());

        var invalid = resolver.resolve(10L, "fix: update FA-999", "(?i)\\bFA-\\d+\\b");

        assertThat(invalid.status()).isEqualTo(GitCommitValidationStatus.INVALID);
        assertThat(invalid.details()).contains("FA-999", "does not exist");
    }

    @Test
    void taskFromAnotherRootIsOutsideProject() {
        Project outsideRoot = project(30L, 7L, null);
        SprintBacklog item = mock(SprintBacklog.class);
        when(item.getIsActive()).thenReturn(true);
        when(item.getProjectId()).thenReturn(30L);
        when(tasks.findById(45L)).thenReturn(Optional.of(item));
        when(projects.findById(30L)).thenReturn(Optional.of(outsideRoot));

        var resolution = resolver.resolve(10L, "fix(task): update FA-45", "(?i)\\bFA-\\d+\\b");

        assertThat(resolution.status()).isEqualTo(GitCommitValidationStatus.OUTSIDE_PROJECT);
        assertThat(resolution.details()).contains("different Project root", "sprint_backlog_id=45", "project_id=30");
    }

    @Test
    void foreignWorkspacePrefixIsDetectedAndClassifiedOutsideTheCurrentRoot() {
        Workspace currentWorkspace = workspace("FA");
        Workspace foreignWorkspace = workspace("OTHER");
        when(workspaces.findAllByTenant_IdAndStatusAndIsActiveTrue(7L, WorkspaceStatus.ACTIVE))
                .thenReturn(java.util.List.of(currentWorkspace, foreignWorkspace));
        Project outsideRoot = project(30L, 7L, null);
        SprintBacklog item = mock(SprintBacklog.class);
        when(item.getIsActive()).thenReturn(true);
        when(item.getProjectId()).thenReturn(30L);
        when(tasks.findById(45L)).thenReturn(Optional.of(item));
        when(projects.findById(30L)).thenReturn(Optional.of(outsideRoot));

        var resolution = resolver.resolve(10L, "fix(task): reference OTHER-45", "(?i)\\bFA-\\d+\\b");

        assertThat(resolution.status()).isEqualTo(GitCommitValidationStatus.OUTSIDE_PROJECT);
        assertThat(resolution.references()).extracting(GitTaskReferenceResolver.KeyResolution::key)
                .containsExactly("OTHER-45");
    }

    @Test
    void anotherProjectsAcronymIsDetectedEvenWithoutAnActiveWorkspacePrefix() {
        Project outsideRoot = project(30L, 7L, null);
        when(outsideRoot.getName()).thenReturn("Outside Project");
        when(projects.findByTenantIdAndIsActiveTrue(7L)).thenReturn(java.util.List.of(root, outsideRoot));
        SprintBacklog item = mock(SprintBacklog.class);
        when(item.getIsActive()).thenReturn(true);
        when(item.getProjectId()).thenReturn(30L);
        when(tasks.findById(45L)).thenReturn(Optional.of(item));
        when(projects.findById(30L)).thenReturn(Optional.of(outsideRoot));

        var resolution = resolver.resolve(10L, "fix(task): reference OP-45", "(?i)\\bFA-\\d+\\b");

        assertThat(resolution.status()).isEqualTo(GitCommitValidationStatus.OUTSIDE_PROJECT);
        assertThat(resolution.references()).extracting(GitTaskReferenceResolver.KeyResolution::key)
                .containsExactly("OP-45");
    }

    @Test
    void taskFromAnotherTenantDoesNotLeakResolvedIds() {
        Project foreignTenantProject = project(80L, 99L, null);
        SprintBacklog item = mock(SprintBacklog.class);
        when(item.getIsActive()).thenReturn(true);
        when(item.getProjectId()).thenReturn(80L);
        when(tasks.findById(45L)).thenReturn(Optional.of(item));
        when(projects.findById(80L)).thenReturn(Optional.of(foreignTenantProject));

        var resolution = resolver.resolve(10L, "fix(task): reference FA-45", "(?i)\\bFA-\\d+\\b");

        assertThat(resolution.status()).isEqualTo(GitCommitValidationStatus.OUTSIDE_PROJECT);
        assertThat(resolution.references()).singleElement().satisfies(reference -> {
            assertThat(reference.taskId()).isNull();
            assertThat(reference.projectId()).isNull();
        });
        assertThat(resolution.details()).doesNotContain("sprint_backlog_id", "project_id=80");
    }

    private static Workspace workspace(String prefix) {
        Workspace workspace = mock(Workspace.class);
        when(workspace.getTaskKeyPrefix()).thenReturn(prefix);
        return workspace;
    }

    private static Project project(Long id, Long tenantId, Project parent) {
        Project project = mock(Project.class);
        when(project.getId()).thenReturn(id);
        when(project.getTenantId()).thenReturn(tenantId);
        when(project.getParentProject()).thenReturn(parent);
        when(project.getName()).thenReturn(id == 10L ? "Foo App" : "Other App");
        return project;
    }
}
