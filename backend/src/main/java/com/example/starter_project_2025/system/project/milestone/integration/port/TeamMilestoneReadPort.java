package com.example.starter_project_2025.system.project.milestone.integration.port;

/** Resolves the tenant from an authorized team, never from a fixed demo project. */
public interface TeamMilestoneReadPort {
    Long requireTenant(Long teamId);
}
