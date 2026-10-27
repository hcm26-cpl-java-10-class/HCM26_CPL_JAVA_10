package com.example.starter_project_2025.system.project.milestone.integration.mock;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneProjectOptionResponse;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectCreationContext;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectReadContext;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectStatus;
import com.example.starter_project_2025.system.project.milestone.integration.port.ProjectMilestonePort;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
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

    @Override
    public List<MilestoneProjectOptionResponse> listAccessibleProjects(UUID actorId, Long tenantId) {
        List<Project> activeProjects = projects.findByTenantIdAndIsActiveTrue(tenantId).stream()
                .filter(this::tenantActive)
                .filter(project -> project.getStatus() != null)
                .toList();

        List<Project> realProjects = activeProjects.stream()
                .filter(project -> project.getCode() == null || !project.getCode().startsWith("DEMO-"))
                .toList();

        List<Project> candidates = realProjects.isEmpty() ? activeProjects : realProjects;
        return candidates.stream()
                .sorted(Comparator
                        .comparingInt((Project p) -> statusPriority(mapStatus(p.getStatus())))
                        .thenComparing(p -> p.getName() == null ? "" : p.getName().toLowerCase(Locale.ROOT))
                        .thenComparing(Project::getId))
                .map(project -> new MilestoneProjectOptionResponse(
                        project.getId(),
                        project.getCode(),
                        project.getName(),
                        mapStatus(project.getStatus())
                ))
                .toList();
    }

    private int statusPriority(ProjectStatus status) {
        return switch (status) {
            case ACTIVE -> 0;
            case PLANNING -> 1;
            case DRAFT -> 2;
            case COMPLETED -> 3;
            case CANCELLED -> 4;
        };
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
