package com.example.starter_project_2025.system.project;

import java.util.List;

/**
 * US-10/US-11: a project template that can be assigned to a DRAFT team,
 * together with the capacity window and role quotas the team must satisfy.
 */
public record ProjectTemplateOptionResponse(
        Long id,
        String code,
        String name,
        int minMembers,
        int maxMembers,
        boolean allowMultiRole,
        List<ProjectTemplateConstraints.RoleQuota> roleQuotas
) {
}
