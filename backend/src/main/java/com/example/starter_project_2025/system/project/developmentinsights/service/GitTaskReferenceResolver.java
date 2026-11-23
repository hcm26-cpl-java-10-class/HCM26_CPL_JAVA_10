package com.example.starter_project_2025.system.project.developmentinsights.service;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommitValidationStatus;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceStatus;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Shared local fixture adapter for the Git task-key contract. Dev A's production resolver can replace this adapter. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GitTaskReferenceResolver {
    private static final Pattern TASK_SUFFIX = Pattern.compile("(\\d+)$");
    private static final Pattern KANBAN_TASK_KEY = Pattern.compile("(?i)\\bTASK-\\d+\\b");
    private final SprintBacklogRepository tasks;
    private final ProjectRepository projects;
    private final WorkspaceRepository workspaces;

    public Resolution resolve(Long rootProjectId, String message, String taskKeyPattern) {
        String source = message == null ? "" : message;
        LinkedHashSet<String> keys = new LinkedHashSet<>();
        Project root = projects.findById(rootProjectId).orElse(null);
        LinkedHashSet<String> acceptedPatterns = new LinkedHashSet<>();
        acceptedPatterns.add(taskKeyPattern);
        if (root != null && root.getTenantId() != null) {
            workspaces.findAllByTenant_IdAndStatusAndIsActiveTrue(root.getTenantId(), WorkspaceStatus.ACTIVE).stream()
                    .map(workspace -> workspace.getTaskKeyPrefix())
                    .filter(prefix -> prefix != null && !prefix.isBlank())
                    .map(prefix -> "(?i)\\b" + Pattern.quote(prefix.trim()) + "-\\d+\\b")
                    .forEach(acceptedPatterns::add);
            projects.findByTenantIdAndIsActiveTrue(root.getTenantId()).stream()
                    .map(Project::getName).map(GitTaskReferenceResolver::projectKeyOf)
                    .map(prefix -> "(?i)\\b" + Pattern.quote(prefix) + "-\\d+\\b")
                    .forEach(acceptedPatterns::add);
        }
        acceptedPatterns.stream().map(pattern -> Pattern.compile(pattern, Pattern.CASE_INSENSITIVE))
                .forEach(pattern -> {
                    Matcher matcher = pattern.matcher(source);
                    while (matcher.find()) keys.add(matcher.group());
                });
        Matcher kanban = KANBAN_TASK_KEY.matcher(source);
        while (kanban.find()) keys.add(kanban.group());
        if (keys.isEmpty()) return new Resolution(GitCommitValidationStatus.MISSING,
                "Commit message does not contain a Task Key.", List.of());

        List<KeyResolution> references = new ArrayList<>();
        boolean invalid = false;
        boolean outside = false;
        for (String key : keys) {
            Matcher suffix = TASK_SUFFIX.matcher(key);
            if (!suffix.find()) {
                invalid = true;
                references.add(new KeyResolution(key, GitCommitValidationStatus.INVALID, null, null, "Invalid Task Key format."));
                continue;
            }
            long taskId;
            try {
                taskId = Long.parseLong(suffix.group(1));
            } catch (NumberFormatException ex) {
                invalid = true;
                references.add(new KeyResolution(key, GitCommitValidationStatus.INVALID, null, null,
                        "Task ID is outside the supported range."));
                continue;
            }
            SprintBacklog task = tasks.findById(taskId)
                    .filter(item -> Boolean.TRUE.equals(item.getIsActive())).orElse(null);
            if (task == null) {
                invalid = true;
                references.add(new KeyResolution(key, GitCommitValidationStatus.INVALID, null, null,
                        "Task does not exist or is inactive."));
                continue;
            }
            Long projectId = task.getProjectId() != null ? task.getProjectId()
                    : task.getSprint() == null ? null : task.getSprint().getProjectId();
            Project taskProject = projectId == null ? null : projects.findById(projectId).orElse(null);
            if (taskProject == null || root == null) {
                invalid = true;
                references.add(new KeyResolution(key, GitCommitValidationStatus.INVALID, null, null,
                        "Task cannot be resolved in this Project tenant."));
                continue;
            }
            if (!Objects.equals(taskProject.getTenantId(), root.getTenantId())) {
                outside = true;
                references.add(new KeyResolution(key, GitCommitValidationStatus.OUTSIDE_PROJECT, null, null,
                        "Task belongs outside this Project tenant."));
                continue;
            }
            if (!Objects.equals(rootId(taskProject), rootProjectId)) {
                outside = true;
                references.add(new KeyResolution(key, GitCommitValidationStatus.OUTSIDE_PROJECT, taskId, projectId,
                        "Task belongs to a different Project root."));
                continue;
            }
            references.add(new KeyResolution(key, GitCommitValidationStatus.PASSED, taskId, projectId,
                    "Task reference is valid."));
        }
        GitCommitValidationStatus status = outside ? GitCommitValidationStatus.OUTSIDE_PROJECT
                : invalid ? GitCommitValidationStatus.INVALID : GitCommitValidationStatus.PASSED;
        String reason = switch (status) {
            case PASSED -> "All Task Keys resolve to active Tasks in this Project root.";
            case INVALID -> "One or more Task Keys do not resolve to an active Task.";
            case OUTSIDE_PROJECT -> "One or more Task Keys resolve outside this Project root.";
            default -> "Task Key validation could not be completed.";
        };
        return new Resolution(status, reason, List.copyOf(references));
    }

    private Long rootId(Project project) {
        java.util.Set<Long> seen = new java.util.HashSet<>();
        Project current = project;
        while (current != null && current.getId() != null && seen.add(current.getId())) {
            if (current.getParentProject() == null) return current.getId();
            current = current.getParentProject();
        }
        return null;
    }

    private static String projectKeyOf(String name) {
        if (name == null || name.isBlank()) return "SB";
        String acronym = java.util.Arrays.stream(name.split("[^A-Za-z0-9]+"))
                .filter(token -> !token.isBlank() && !token.matches("\\d+"))
                .map(token -> token.substring(0, 1)).collect(java.util.stream.Collectors.joining());
        return acronym.length() >= 2 ? acronym.substring(0, Math.min(10, acronym.length())).toUpperCase(java.util.Locale.ROOT) : "SB";
    }

    public record KeyResolution(String key, GitCommitValidationStatus status, Long taskId,
                                Long projectId, String reason) { }
    public record Resolution(GitCommitValidationStatus status, String reason, List<KeyResolution> references) {
        public String details() {
            return references == null ? "" : references.stream()
                    .map(reference -> reference.key() + " → "
                            + (reference.taskId() == null ? "" : "sprint_backlog_id=" + reference.taskId() + ", ")
                            + (reference.projectId() == null ? "" : "project_id=" + reference.projectId() + ", ")
                            + reference.reason())
                    .collect(java.util.stream.Collectors.joining("\n"));
        }
    }
}
