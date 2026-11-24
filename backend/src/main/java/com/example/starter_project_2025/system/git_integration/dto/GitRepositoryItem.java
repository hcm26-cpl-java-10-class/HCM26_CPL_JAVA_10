package com.example.starter_project_2025.system.git_integration.dto;

/**
 * One repository the installation can access. {@code selectable} is false when
 * it is already linked to a project or archived; {@code unavailableReason} says why.
 */
public record GitRepositoryItem(
        Long externalId,
        String name,
        String owner,
        String fullName,
        String htmlUrl,
        String visibility,
        String defaultBranch,
        boolean archived,
        LinkedProject linkedProject,
        boolean selectable,
        String unavailableReason) {

    /** Project the repository is actively linked to; code/name are hidden outside the user's tenant. */
    public record LinkedProject(Long id, String code, String name) {
    }
}
