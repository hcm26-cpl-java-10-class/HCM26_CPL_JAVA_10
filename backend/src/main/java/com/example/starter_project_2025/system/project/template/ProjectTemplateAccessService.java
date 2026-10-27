package com.example.starter_project_2025.system.project.template;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.project.trainingclass.UserDataScopeRepository;
import com.example.starter_project_2025.system.project.trainingclass.UserScopeType;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ProjectTemplateAccessService {
    private final UserRepository users;
    private final TenantRepository tenants;
    private final UserDataScopeRepository scopes;

    public User requireUser(String action) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new AuthenticationCredentialsNotFoundException("Please sign in");
        }
        User user = users.findById(principal.getUser().getId())
                .orElseThrow(() -> new AuthenticationCredentialsNotFoundException("Please sign in"));
        boolean admin = hasRole(user, "ADMIN");
        if (!Boolean.TRUE.equals(user.getIsActive()) || Boolean.TRUE.equals(user.getLocked())
                || (!admin && !hasRole(user, "PROGRAM_MANAGER")) || !can(user, action)) {
            throw new AccessDeniedException("Project template access is not allowed");
        }
        Long tenantId = user.getTenantId();
        if (tenantId == null) {
            throw new AccessDeniedException("A tenant must be assigned to manage project templates");
        }
        var tenant = tenants.findById(tenantId)
                .filter(value -> Boolean.TRUE.equals(value.getIsActive()) && Boolean.TRUE.equals(value.getActive()))
                .orElseThrow(() -> new AccessDeniedException("The current tenant is not available"));
        if (!admin && !scopes.existsByUser_IdAndTenantIdAndScopeTypeAndTargetIdAndIsActiveTrue(
                user.getId(), tenantId, UserScopeType.TENANT, tenant.getId())) {
            throw new AccessDeniedException("Project templates are outside your data scope");
        }
        return user;
    }

    public boolean can(User user, String action) {
        if ("ACTIVATE".equals(action) && !hasRole(user, "ADMIN")
                && (!hasRole(user, "PROGRAM_MANAGER") || !hasTenantScope(user))) {
            return false;
        }
        String name = "PROJECT_TEMPLATE_" + action;
        return user.getRoles().stream().filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .flatMap(role -> role.getPermissions().stream())
                .anyMatch(permission -> Boolean.TRUE.equals(permission.getIsActive())
                        && name.equals(permission.getName()));
    }

    private boolean hasTenantScope(User user) {
        return user.getTenantId() != null && scopes.existsByUser_IdAndTenantIdAndScopeTypeAndTargetIdAndIsActiveTrue(
                user.getId(), user.getTenantId(), UserScopeType.TENANT, user.getTenantId());
    }

    private boolean hasRole(User user, String name) {
        return user.getRoles().stream().anyMatch(role -> Boolean.TRUE.equals(role.getIsActive())
                && name.equals(role.getName()));
    }
}
