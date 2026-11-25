package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.contributor.GitProjectMembership;
import com.example.starter_project_2025.system.git_integration.tasklink.ProjectScopeResolver;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * GI-04 / GI-05: who may change, synchronize and see the repository of a master project.
 * <p>
 * GI-05 BR: only the PM of the master project or a Git Integration manager
 * ({@code GIT_INTEGRATION_MANAGE}) changes the configuration (link, unlink, sync again a
 * connection in ERROR / DISCONNECTED); developers who can open the project only see it.
 */
@Component
@RequiredArgsConstructor
public class GitRepositoryLinkPolicy {

    private final GitIntegrationAccessService access;
    private final WorkspaceAccessService workspaceAccess;
    private final ProjectScopeResolver scopes;
    private final GitProjectMembership membership;

    /** GI-05: a Git Integration manager, or a PM of a team of the master project itself (not of a module). */
    public boolean canManage(User user, Project master) {
        if (access.canManage(user)) return true;
        return membership.members(Set.of(master.getId())).stream()
                .anyMatch(member -> member.userId().equals(user.getId()) && member.isPm());
    }

    public void requireCanManage(User user, Project master) {
        if (!canManage(user, master)) {
            throw new AccessDeniedException("Managing this project's repository is not allowed");
        }
    }

    public boolean canLink(User user, Project master) {
        return canManage(user, master);
    }

    public void requireCanLink(User user, Project master) {
        if (!canLink(user, master)) {
            throw new AccessDeniedException("Linking a repository to this project is not allowed");
        }
    }

    /**
     * SY-01: who may synchronize the repository of a master project ("Sync now", resume):
     * Git Integration managers, a PM of the master or one of its modules, or their mentor.
     */
    public boolean canSync(User user, Project master) {
        if (access.canManage(user)) return true;
        Set<Long> scope = scopes.scope(master.getId());
        return membership.isMentor(user.getId(), scope) || membership.members(scope).stream()
                .anyMatch(member -> member.userId().equals(user.getId()) && member.isPm());
    }

    public void requireCanSync(User user, Project master) {
        if (!canSync(user, master)) {
            throw new AccessDeniedException("Synchronizing this project's repository is not allowed");
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
