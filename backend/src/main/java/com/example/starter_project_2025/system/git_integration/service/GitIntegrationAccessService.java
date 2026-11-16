package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

/**
 * Authorization for Git Integration. Requires an authenticated, active user
 * with the integration permission, and a project inside the user's tenant.
 * Deliberately independent of workspace permissions such as WORKSPACE_READ.
 */
@Service
@RequiredArgsConstructor
public class GitIntegrationAccessService {

    public static final String PERMISSION_READ = "GIT_INTEGRATION_READ";
    public static final String PERMISSION_MANAGE = "GIT_INTEGRATION_MANAGE";

    private final UserRepository users;
    private final WorkspaceAccessService workspaceAccess;

    public User requireUser() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new AuthenticationCredentialsNotFoundException("Please sign in");
        }
        User user = users.findById(principal.getUser().getId())
                .orElseThrow(() -> new AuthenticationCredentialsNotFoundException("Please sign in"));
        if (!Boolean.TRUE.equals(user.getIsActive()) || Boolean.TRUE.equals(user.getLocked())) {
            throw new AccessDeniedException("User is inactive");
        }
        if (user.getTenant() == null) {
            throw new AccessDeniedException("Tenant is not assigned");
        }
        return user;
    }

    public boolean canManage(User user) {
        return workspaceAccess.permitted(user, PERMISSION_MANAGE);
    }

    /** 403 unless the user may manage Git Integration; 404 if the project is missing or outside the tenant. */
    public Project requireManage(User user, Long projectId) {
        if (!canManage(user)) {
            throw new AccessDeniedException("Git Integration management is not allowed");
        }
        return workspaceAccess.requireProject(user, projectId, false);
    }

    public Project requireRead(User user, Long projectId) {
        if (!canManage(user) && !workspaceAccess.permitted(user, PERMISSION_READ)) {
            throw new AccessDeniedException("Git Integration access is not allowed");
        }
        return workspaceAccess.requireProject(user, projectId, false);
    }
}
