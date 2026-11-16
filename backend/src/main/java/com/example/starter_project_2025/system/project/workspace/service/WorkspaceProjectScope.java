package com.example.starter_project_2025.system.project.workspace.service;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.resources.TeamSubprojectAssignment;
import com.example.starter_project_2025.system.project.resources.TeamSubprojectAssignmentRepository;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class WorkspaceProjectScope {
    private final TeamSubprojectAssignmentRepository assignments;

    public List<Project> projects(Workspace workspace) {
        List<Project> assigned = assignments.findAllByWorkspaceIdAndIsActiveTrueOrderByIdAsc(workspace.getId())
                .stream().map(TeamSubprojectAssignment::getProject).toList();
        if (!assigned.isEmpty()) return assigned;
        Project primary = workspace.getProject();
        if (primary == null) return List.of();
        if (primary.getAssignmentId() == null) return List.of(primary);
        return assignments.findAllByTeam_IdAndIsActiveTrueOrderByIdAsc(workspace.getTeam().getId()).stream()
                .map(TeamSubprojectAssignment::getProject)
                .filter(project -> Objects.equals(project.getAssignmentId(), primary.getAssignmentId())).toList();
    }

    public boolean contains(Workspace workspace, Long projectId) {
        return projects(workspace).stream().anyMatch(project -> project.getId().equals(projectId));
    }

    public boolean readOnly(Workspace workspace) {
        return workspace.getCurrentSlot() == null
                || workspace.getStatus() != com.example.starter_project_2025.system.project.workspace.domain.WorkspaceStatus.ACTIVE;
    }
}
