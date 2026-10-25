package com.example.starter_project_2025.system.project.milestone.service;

import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectReadContext;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectStatus;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MilestoneAccessPolicyTest {

    private final MilestoneAccessPolicy policy = new MilestoneAccessPolicy();

    @Test
    void allowsReadingCompletedAndCancelledProjects() {
        assertDoesNotThrow(() -> policy.requireReadAccess(context(ProjectStatus.COMPLETED, true, true)));
        assertDoesNotThrow(() -> policy.requireReadAccess(context(ProjectStatus.CANCELLED, true, true)));
    }

    @Test
    void rejectsInactiveTenant() {
        assertThrows(AccessDeniedException.class,
                () -> policy.requireReadAccess(context(ProjectStatus.ACTIVE, false, true)));
    }

    @Test
    void rejectsRemovedMentorAssignment() {
        assertThrows(AccessDeniedException.class,
                () -> policy.requireReadAccess(context(ProjectStatus.ACTIVE, true, false)));
    }

    private ProjectReadContext context(
            ProjectStatus status,
            boolean tenantActive,
            boolean mentorAssigned
    ) {
        return new ProjectReadContext(
                UUID.randomUUID(), UUID.randomUUID(), "Project", status, tenantActive, mentorAssigned
        );
    }
}
