package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

/**
 * Authorization for Git Integration. Installations belong to the user's
 * tenant, so access is permission based and tenant scoped — no project check.
 */
@Service
@RequiredArgsConstructor
public class GitIntegrationAccessService {

    public static final String PERMISSION_READ = "GIT_INTEGRATION_READ";
    public static final String PERMISSION_MANAGE = "GIT_INTEGRATION_MANAGE";

    private final UserRepository users;
    private final WorkspaceAccessService workspaceAccess;

    /** 401 when not signed in; 403 when inactive, locked or without a tenant. */
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

    public void requireManage(User user) {
        if (!canManage(user)) {
            throw new AccessDeniedException("Git Integration management is not allowed");
        }
    }

    public void requireRead(User user) {
        if (!canManage(user) && !workspaceAccess.permitted(user, PERMISSION_READ)) {
            throw new AccessDeniedException("Git Integration access is not allowed");
        }
    }
}
