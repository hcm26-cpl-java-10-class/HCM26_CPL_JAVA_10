package com.example.starter_project_2025.system.project.milestone.service;

import com.example.starter_project_2025.system.project.milestone.exception.MilestoneConflictException;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectCreationContext;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectReadContext;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

@Component
public class MilestoneAccessPolicy {
    public void requireAccess(ProjectCreationContext project) {
        if (!project.tenantActive()) {
            throw new AccessDeniedException("Tenant is inactive");
        }
        if (!project.mentorAssigned()) {
            throw new AccessDeniedException("Project assignment is no longer active");
        }
    }

    public void requireReadAccess(ProjectReadContext project) {
        if (!project.tenantActive()) {
            throw new AccessDeniedException("Tenant is inactive");
        }
        if (!project.mentorAssigned()) {
            throw new AccessDeniedException("Project assignment is no longer active");
        }
    }

    public void requireCreatableState(ProjectCreationContext project) {
        if (!project.milestoneCreationAllowed()
                || project.status() == ProjectStatus.DRAFT
                || project.status() == ProjectStatus.COMPLETED
                || project.status() == ProjectStatus.CANCELLED) {
            throw new MilestoneConflictException("Project no longer allows milestone creation; reload project state");
        }
    }

    public void requireSubmittableState(ProjectReadContext project) {
        if (project.status() != ProjectStatus.ACTIVE) {
            throw new MilestoneConflictException("Project does not accept artifact submissions in its current state");
        }
    }
}
