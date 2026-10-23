package com.example.starter_project_2025.system.project.milestone.integration.mock;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
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

    public MockProjectMilestoneAdapter(
            @Value("${milestone.mock.project-status:ACTIVE}") ProjectStatus projectStatus,
            @Value("${milestone.mock.tenant-active:true}") boolean tenantActive,
            @Value("${milestone.mock.mentor-assigned:true}") boolean mentorAssigned
    ) {
        this.projectStatus = projectStatus;
        this.tenantActive = tenantActive;
        this.mentorAssigned = mentorAssigned;
    }

    @Override
    public ProjectCreationContext requireProjectForCreation(UUID projectId, UUID actorId, UUID tenantId) {
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
    public ProjectReadContext requireProjectForRead(UUID projectId, UUID actorId, UUID tenantId) {
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

    private void requireMockProject(UUID projectId, UUID tenantId) {
        if (MockMilestoneData.OUT_OF_SCOPE_PROJECT_ID.equals(projectId)) {
            throw new AccessDeniedException("Project is outside the current scope");
        }
        if ((!MockMilestoneData.PROJECT_ID.equals(projectId)
                && !MockMilestoneData.SECOND_PROJECT_ID.equals(projectId))
                || !MockMilestoneData.TENANT_ID.equals(tenantId)) {
            throw new ResourceNotFoundException("Project not found");
        }
    }

    private String projectName(UUID projectId) {
        return MockMilestoneData.SECOND_PROJECT_ID.equals(projectId)
                ? "Secondary OJT Project"
                : "OJT Management System";
    }
}
