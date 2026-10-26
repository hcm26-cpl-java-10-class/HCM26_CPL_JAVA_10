package com.example.starter_project_2025.system.project.milestone.integration.mock;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectCreationContext;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectReadContext;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectStatus;
import com.example.starter_project_2025.system.project.milestone.integration.port.ProjectMilestonePort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@Profile("!milestone-real-integrations")
public class MockProjectMilestoneAdapter implements ProjectMilestonePort {

    private final ProjectStatus projectStatus;
    private final boolean tenantActive;
    private final boolean mentorAssigned;
    private final ProjectRepository projects;

    public MockProjectMilestoneAdapter(
            @Value("${milestone.mock.project-status:ACTIVE}") ProjectStatus projectStatus,
            @Value("${milestone.mock.tenant-active:true}") boolean tenantActive,
            @Value("${milestone.mock.mentor-assigned:true}") boolean mentorAssigned,
            ProjectRepository projects
    ) {
        this.projectStatus = projectStatus;
        this.tenantActive = tenantActive;
        this.mentorAssigned = mentorAssigned;
        this.projects = projects;
    }

    @Override
    public ProjectCreationContext requireProjectForCreation(Long projectId, UUID actorId, Long tenantId) {
        requireMockProject(projectId, tenantId);

        return new ProjectCreationContext(
                projectId,
                tenantId,
                projectName(projectId),
                projectStatus,
                tenantActive,
                mentorAssigned,
                projectStatus == ProjectStatus.ACTIVE
        );
    }

    @Override
    public ProjectReadContext requireProjectForRead(Long projectId, UUID actorId, Long tenantId) {
        requireMockProject(projectId, tenantId);
        return new ProjectReadContext(
                projectId,
                tenantId,
                projectName(projectId),
                projectStatus,
                tenantActive,
                mentorAssigned
        );
    }

    private void requireMockProject(Long projectId, Long tenantId) {
        if (MockMilestoneData.OUT_OF_SCOPE_PROJECT_ID.equals(projectId)) {
            throw new AccessDeniedException("Project is outside the current scope");
        }
        if (!projects.findById(projectId)
                .filter(project -> project.getTenant() != null
                        && tenantId.equals(project.getTenant().getId())
                        && Boolean.TRUE.equals(project.getIsActive()))
                .isPresent()) {
            throw new ResourceNotFoundException("Project not found");
        }
    }

    private String projectName(Long projectId) {
        return projects.findById(projectId).map(Project::getName).orElse("Workspace project");
    }
}
