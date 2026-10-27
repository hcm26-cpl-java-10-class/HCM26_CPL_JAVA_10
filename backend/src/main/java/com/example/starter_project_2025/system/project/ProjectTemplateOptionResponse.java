package com.example.starter_project_2025.system.project;

/**
 * US-10: a project template that can be assigned to a DRAFT team, together with
 * the capacity window the team size must satisfy.
 */
public record ProjectTemplateOptionResponse(
        Long id,
        String code,
        String name,
        int minMembers,
        int maxMembers
) {
}
