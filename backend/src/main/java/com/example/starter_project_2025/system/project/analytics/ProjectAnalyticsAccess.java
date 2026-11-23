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
import java.util.Set;

/**
 * US-ANL-001: deny-by-default access control for project Analytics.
 * US-ANL-010: export access control (Mentor, Program Manager, Admin or active
 * Student Team Leader of the target project).
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

    /** US-ANL-010: permission gating CSV / PDF report export. */
    public static final String EXPORT_PERMISSION = "PROJECT_ANALYTICS_EXPORT";

    /** Non-student management/staff roles eligible to export any authorized project. */
    private static final Set<String> EXPORT_STAFF_ROLES = Set.of(
            "ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "PO",
            "PROGRAM_MANAGER", "PM", "MENTOR", "TEACHER", "TRAINER", "CLASS_ADMIN", "TEAM_LEADER");

    private final UserRepository users;
    private final TenantRepository tenants;
    private final ProjectRepository projects;
    private final WorkspaceAccessService workspaceAccess;
    private final ProjectAnalyticsWorkItemRepository workItems;

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

    /**
     * US-ANL-010: returns whether the caller is allowed to export analytics for
     * the given project (Mentor, Program Manager, Admin/Teacher/PM with export
     * permission, or an active Student Team Leader of the project).
     */
    public boolean canExport(User user, Project project) {
        if (user == null || project == null) {
            return false;
        }
        if (!Objects.equals(project.getTenantId(), user.getTenantId())) {
            return false;
        }
        if (!hasPermission(user, EXPORT_PERMISSION)) {
            return false;
        }
        if (!workspaceAccess.canAccessProject(user, project)) {
            return false;
        }
        boolean hasStaffRole = user.getRoles().stream()
                .filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .map(role -> role.getName() == null ? "" : role.getName().trim().toUpperCase())
                .anyMatch(EXPORT_STAFF_ROLES::contains);
        if (hasStaffRole) {
            return true;
        }
        return workItems.isProjectTeamLeader(user.getId(), project);
    }

    /**
     * US-ANL-010 AC02: enforces export permission and project scope before any
     * export file or audit log is generated.
     */
    public void requireExportAccess(User user, Project project) {
        if (!canExport(user, project)) {
            throw new AccessDeniedException(
                    "Only authorized Mentors, Program Managers, and Team Leaders may export project analytics");
        }
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
