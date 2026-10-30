package com.example.starter_project_2025.system.project.milestone.submission.integration;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

@Component
@Profile("!test & !milestone-mock-completion")
@RequiredArgsConstructor
public class JpaProjectCompletionAdapter implements ProjectCompletionPort {
    private final ProjectRepository projects;

    @Override
    public boolean isActive(Long projectId, Long tenantId) {
        return projectId != null && projects.findById(projectId)
                .filter(project -> tenantId.equals(project.getTenantId()))
                .map(project -> project.getStatus() == ProjectStatus.ACTIVE).orElse(false);
    }

    @Override
    public void complete(Long projectId, Long teamId, UUID actorId, Instant completedAt) {
        projects.findById(projectId)
                .filter(project -> teamId.equals(project.getTeamId()) && project.getStatus() == ProjectStatus.ACTIVE)
                .ifPresent(project -> {
                    project.setStatus(ProjectStatus.COMPLETED);
                    projects.save(project);
                });
    }
}
