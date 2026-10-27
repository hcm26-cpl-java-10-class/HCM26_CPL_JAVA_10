package com.example.starter_project_2025.system.project.milestone.integration.mock;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectCreationContext;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectReadContext;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectStatus;
import com.example.starter_project_2025.system.project.milestone.integration.port.ProjectMilestonePort;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@Profile("!milestone-mock")
public class MockProjectMilestoneAdapter implements ProjectMilestonePort {

    private final ProjectRepository projects;
    private final ProjectTeamRepository teams;

    public MockProjectMilestoneAdapter(
            ProjectRepository projects,
            ProjectTeamRepository teams
    ) {
        this.projects = projects;
        this.teams = teams;
    }

    @Override
    public ProjectCreationContext requireProjectForCreation(Long projectId, UUID actorId, Long tenantId) {
        Project project = requireProject(projectId, tenantId);
        ProjectStatus status = mapStatus(project.getStatus());

        return new ProjectCreationContext(
                projectId,
                tenantId,
                project.getName(),
                status,
                tenantActive(project),
                mentorAssigned(projectId),
                status == ProjectStatus.ACTIVE || status == ProjectStatus.PLANNING
        );
    }

    @Override
    public ProjectReadContext requireProjectForRead(Long projectId, UUID actorId, Long tenantId) {
        Project project = requireProject(projectId, tenantId);
        return new ProjectReadContext(
                projectId,
                tenantId,
                project.getName(),
                mapStatus(project.getStatus()),
                tenantActive(project),
                mentorAssigned(projectId)
        );
    }

    private Project requireProject(Long projectId, Long tenantId) {
        Project project = projects.findById(projectId)
                .filter(candidate -> candidate.getTenant() != null
                        && tenantId.equals(candidate.getTenant().getId())
                        && Boolean.TRUE.equals(candidate.getIsActive()))
                .orElseThrow(() ->
                        new ResourceNotFoundException("Project not found"));
        return project;
    }

    private boolean tenantActive(Project project) {
        return project.getTenant() != null
                && Boolean.TRUE.equals(project.getTenant().getActive())
                && Boolean.TRUE.equals(project.getTenant().getIsActive());
    }

    private boolean mentorAssigned(Long projectId) {
        return teams.findAllByProject_IdInOrderByIdDesc(java.util.List.of(projectId)).stream()
                .anyMatch(team -> team.getAssignedMentorId() != null);
    }

    private ProjectStatus mapStatus(com.example.starter_project_2025.system.project.domain.ProjectStatus status) {
        if (status == null) {
            throw new ResourceNotFoundException("Project not found");
        }
        return switch (status) {
            case DRAFT -> ProjectStatus.DRAFT;
            case PLANNING -> ProjectStatus.PLANNING;
            case ACTIVE -> ProjectStatus.ACTIVE;
            case COMPLETED -> ProjectStatus.COMPLETED;
            case CANCELLED -> ProjectStatus.CANCELLED;
        };
    }
}
