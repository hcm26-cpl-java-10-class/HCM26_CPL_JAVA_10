package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

/**
 * GI-04: who may link a repository to a master project and who may see it.
 * <p>
 * Interim rule (fine-grained authorization comes once all GitHub features are
 * done): linking needs {@code GIT_INTEGRATION_MANAGE} in the project's tenant.
 * This is the only place to change when the rule becomes "mentor of a team of
 * the master / class manager / PO / admin".
 */
@Component
@RequiredArgsConstructor
public class GitRepositoryLinkPolicy {

    private final GitIntegrationAccessService access;
    private final WorkspaceAccessService workspaceAccess;

    public boolean canLink(User user, Project master) {
        return access.canManage(user);
    }

    public void requireCanLink(User user, Project master) {
        if (!canLink(user, master)) {
            throw new AccessDeniedException("Linking a repository to this project is not allowed");
        }
    }

    /**
     * Git Integration readers, plus anyone who can open the project through its
     * teams (members and mentors see their project's repository without the
     * Git Integration permission).
     */
    public boolean canView(User user, Project project) {
        return access.canManage(user)
                || workspaceAccess.permitted(user, GitIntegrationAccessService.PERMISSION_READ)
                || workspaceAccess.canAccessProject(user, project);
    }

    public void requireCanView(User user, Project project) {
        if (!canView(user, project)) {
            throw new AccessDeniedException("Viewing this project's repository is not allowed");
        }
    }
}
