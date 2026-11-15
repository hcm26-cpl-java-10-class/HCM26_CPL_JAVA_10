package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import com.example.starter_project_2025.system.project.workspace.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkspaceHierarchyService {
    public record Node(Long id, Long parentProjectId, String code, String name, String status,
                       Long teamId, boolean assigned, String description, String technologyStack, List<Node> children) { }
    public record History(Long workspaceId, String name, String status, LocalDateTime createdAt, boolean current) { }
    public record Context(Long workspaceId, Long assignmentId, AssignmentDtos.Mode mode, Instant assignedAt,
                          boolean readOnly, List<Node> projects, List<History> history) { }

    private final WorkspaceAccessService access;
    private final WorkspaceContextService contexts;
    private final WorkspaceProjectScope scope;
    private final WorkspaceRepository workspaces;
    private final ProjectRepository projects;
    private final ProjectAssignmentRepository assignments;
    private final ProjectTemplateSnapshotRepository snapshots;
    private final ObjectMapper json;

    public Context get(Long workspaceId) {
        var workspace = contexts.require(access.requireUser(false), workspaceId);
        List<Project> owned = scope.projects(workspace);
        Set<Long> visible = new HashSet<>(owned.stream().map(Project::getId).toList());
        Long assignmentId = workspace.getProject() == null ? null : workspace.getProject().getAssignmentId();
        ProjectAssignment assignment = assignmentId == null ? null : assignments.findById(assignmentId)
                .filter(value -> value.getTenantId().equals(workspace.getTenant().getId())
                        && value.getClassId().equals(workspace.getTeam().getTrainingClass().getId()))
                .orElseThrow(() -> AssignmentException.invalid("The workspace assignment scope is invalid"));
        List<Project> family = assignment == null ? owned : projects.findAllByAssignmentIdAndTenantIdAndIsActiveTrueOrderByIdAsc(
                assignmentId, workspace.getTenant().getId());
        List<Node> roots = family.stream().filter(project -> project.getParentProject() == null
                        || family.stream().noneMatch(parent -> parent.getId().equals(project.getParentProject().getId())))
                .map(project -> node(project, family, visible, new HashSet<>())).filter(Objects::nonNull).toList();
        List<History> history = workspaces.findAllByTeam_IdAndIsActiveTrueOrderByCreatedAtDescIdDesc(workspace.getTeam().getId()).stream()
                .map(previous -> new History(previous.getId(), previous.getName(), previous.getStatus().name(),
                        previous.getCreatedAt(), previous.getCurrentSlot() != null)).toList();
        return new Context(workspaceId, assignmentId, assignment == null ? null : assignment.getMode(),
                assignment == null ? null : assignment.getAssignedAt(), scope.readOnly(workspace), roots, history);
    }

    private Node node(Project project, List<Project> family, Set<Long> visible, Set<Long> visited) {
        if (!visited.add(project.getId())) throw AssignmentException.invalid("The saved project hierarchy contains a cycle");
        List<Node> children = family.stream().filter(child -> child.getParentProject() != null
                        && child.getParentProject().getId().equals(project.getId()))
                .map(child -> node(child, family, visible, visited)).filter(Objects::nonNull).toList();
        boolean assigned = visible.contains(project.getId());
        if (!assigned && children.isEmpty()) return null;
        String description = assigned ? project.getDescription() : null;
        String technologyStack = null;
        if (assigned && project.getAssignmentId() != null) {
            var snapshot = snapshots.findById(project.getTemplateSnapshotId())
                    .filter(value -> project.getId().equals(value.getProjectId()))
                    .orElseThrow(() -> new IllegalStateException("The project brief snapshot does not match its project"));
            try {
                var brief = json.readTree(snapshot.getContentJson());
                description = brief.path("description").asText("");
                technologyStack = brief.path("technologyStack").asText("");
            } catch (JsonProcessingException exception) {
                throw new IllegalStateException("The saved project brief is invalid", exception);
            }
        }
        return new Node(project.getId(), project.getParentProject() == null ? null : project.getParentProject().getId(),
                project.getCode(), project.getName(), project.getStatus().name(), project.getTeamId(), assigned, description, technologyStack, children);
    }
}
