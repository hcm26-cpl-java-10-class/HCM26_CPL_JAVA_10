package com.example.starter_project_2025.system.project.analytics;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Objects;

/**
 * US-ANL-001: deny-by-default access control for project Analytics.
 *
 * <p>A caller needs an authenticated, active account in an ACTIVE tenant plus
 * valid project scope (team member, assigned mentor or PM/admin scope). The
 * rules intentionally return 404 for missing/inactive projects and 403 for
 * everything the caller is not allowed to see, without exposing project
 * metadata in either case.</p>
 */
@Service
@RequiredArgsConstructor
public class ProjectAnalyticsAccess {

    /** US-ANL-001: the single permission that gates the Analytics workspace. */
    public static final String READ_PERMISSION = "PROJECT_ANALYTICS_READ";

    private final UserRepository users;
    private final TenantRepository tenants;
    private final ProjectRepository projects;
    private final WorkspaceAccessService workspaceAccess;

    /**
     * Resolves the signed-in user and enforces session, account, tenant and
     * permission preconditions.
     */
    public User requireUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ");
        }
        User user = users.findById(principal.getUser().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ"));
        if (!Boolean.TRUE.equals(user.getIsActive()) || Boolean.TRUE.equals(user.getLocked())) {
            throw new AccessDeniedException("This account is not active");
        }
        if (user.getTenantId() == null) {
            throw new AccessDeniedException("Tenant is not assigned");
        }
        Tenant tenant = tenants.findById(user.getTenantId())
                .orElseThrow(() -> new AccessDeniedException("Tenant is not available"));
        if (!Boolean.TRUE.equals(tenant.getActive()) || !Boolean.TRUE.equals(tenant.getIsActive())) {
            throw new AccessDeniedException("Tenant is inactive");
        }
        if (!hasPermission(user, READ_PERMISSION)) {
            throw new AccessDeniedException("Project analytics access is not allowed");
        }
        return user;
    }

    /**
     * Resolves one project for the caller.
     *
     * <p>The raw path value is parsed here so a malformed id is reported as
     * 404 (AC04) instead of a framework 400.</p>
     */
    public Project requireProject(User user, String rawProjectId) {
        Long projectId = parseProjectId(rawProjectId);
        Project project = projects.findById(projectId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project was not found"));
        if (!Boolean.TRUE.equals(project.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project was not found");
        }
        if (!Objects.equals(project.getTenantId(), user.getTenantId())) {
            throw new AccessDeniedException("Project is outside the current tenant");
        }
        if (!workspaceAccess.canAccessProject(user, project)) {
            throw new AccessDeniedException("You do not have access to this project");
        }
        return project;
    }

    /** Returns whether the caller has project membership, mentor or PM scope. */
    public boolean canView(User user, Project project) {
        return workspaceAccess.canAccessProject(user, project);
    }

    public boolean hasPermission(User user, String permission) {
        return user.getRoles().stream()
                .filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .flatMap(role -> role.getPermissions().stream())
                .anyMatch(item -> Boolean.TRUE.equals(item.getIsActive()) && permission.equals(item.getName()));
    }

    private Long parseProjectId(String rawProjectId) {
        if (rawProjectId == null || rawProjectId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project was not found");
        }
        try {
            long parsed = Long.parseLong(rawProjectId.trim());
            if (parsed > 0) return parsed;
        } catch (NumberFormatException ignored) {
            // Fall through to the 404 below so an unknown id never leaks whether
            // the value was syntactically valid.
        }
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project was not found");
    }
}
