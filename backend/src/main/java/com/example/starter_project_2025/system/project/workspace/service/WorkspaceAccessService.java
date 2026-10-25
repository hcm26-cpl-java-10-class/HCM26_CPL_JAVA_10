package com.example.starter_project_2025.system.project.workspace.service;

import com.example.starter_project_2025.system.project.ProjectRepository;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.team.Team;
import com.example.starter_project_2025.system.project.team.TeamMember;
import com.example.starter_project_2025.system.project.team.TeamRepository;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class WorkspaceAccessService {
    private final UserRepository users;
    private final TenantRepository tenants;
    private final TeamRepository teams;
    private final ProjectRepository projects;
    private static final Set<String> READ = Set.of("WORKSPACE_READ", "VIEW_PROJECT_WORKSPACE");
    private static final Set<String> CREATE = Set.of("WORKSPACE_CREATE", "CREATE_PROJECT_WORKSPACE");

    public User requireUser(boolean creating) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ");
        }
        User user = users.findById(principal.getUser().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ"));
        if (!Boolean.TRUE.equals(user.getIsActive()) || Boolean.TRUE.equals(user.getLocked())
                || !hasPermission(user, creating ? CREATE : READ)) {
            throw new AccessDeniedException("Workspace permission has been revoked");
        }
        if (user.getTenant() == null) throw new AccessDeniedException("Tenant is not assigned");
        return user;
    }

    public boolean canRead(User user) { return hasPermission(user, READ); }

    public boolean canViewMembers(User user) {
        return hasPermission(user, Set.of("WORKSPACE_MEMBER_READ"));
    }

    public void requireMemberRead(User user) {
        if (!canViewMembers(user)) throw new AccessDeniedException("Member access is not allowed");
    }

    public void requireTeamUpdate(User user) {
        if (!hasPermission(user, Set.of("TEAM_UPDATE"))) throw new AccessDeniedException("Team management is not allowed");
    }

    public boolean permitted(User user, String permission) {
        return hasPermission(user, Set.of(permission));
    }

    private boolean hasPermission(User user, Set<String> required) {
        return user.getRoles().stream().filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .flatMap(role -> role.getPermissions().stream())
                .anyMatch(permission -> Boolean.TRUE.equals(permission.getIsActive()) && required.contains(permission.getName()));
    }

    public Tenant requireTenant(User user, boolean lock) {
        Long id = user.getTenant().getId();
        Tenant tenant = (lock ? tenants.findForWorkspaceCreation(id) : tenants.findById(id))
                .orElseThrow(() -> new AccessDeniedException("Tenant is not available"));
        if (!Boolean.TRUE.equals(tenant.getActive()) || !Boolean.TRUE.equals(tenant.getIsActive())) {
            throw new AccessDeniedException("Tenant is inactive");
        }
        return tenant;
    }

    public Team requirePair(User user, Long projectId, Long teamId, boolean lock) {
        Project project = requireProject(user, projectId, lock);
        Team team = requireTeam(user, teamId, lock);
        if (team.getProject() == null || !team.getProject().getId().equals(projectId)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Project/team không có quan hệ hợp lệ");
        }
        return team;
    }

    public Project requireProject(User user, Long projectId, boolean lock) {
        Project project = (lock ? projects.findForWorkspaceCreation(projectId) : projects.findById(projectId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project was not found"));
        if (!project.getTenant().getId().equals(user.getTenant().getId())) throw new AccessDeniedException("Project is outside the current tenant");
        if (!Boolean.TRUE.equals(project.getIsActive())) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project is inactive");
        return project;
    }

    public Team requireTeam(User user, Long teamId, boolean lock) {
        Team team = (lock ? teams.findForWorkspaceCreation(teamId) : teams.findById(teamId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy team"));
        if (!Boolean.TRUE.equals(team.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project/team không còn tồn tại");
        }
        Long tenantId = user.getTenant().getId();
        if (!team.getTenant().getId().equals(tenantId) || !inScope(user, team)) {
            throw new AccessDeniedException("Project/team is outside the current scope");
        }
        return team;
    }

    private boolean inScope(User user, Team team) {
        boolean admin = user.getRoles().stream().anyMatch(role -> Boolean.TRUE.equals(role.getIsActive())
                && ("ADMIN".equals(role.getName()) || "PO".equals(role.getName())));
        return admin || (team.getMentor() != null && team.getMentor().getId().equals(user.getId()))
                || team.getMembers().stream().anyMatch(member -> member.isCurrentParticipant()
                && member.getUser().getId().equals(user.getId()));
    }

    public boolean canSelectProject(User user, Project project) {
        boolean administrator = user.getRoles().stream().anyMatch(role -> Boolean.TRUE.equals(role.getIsActive())
                && ("ADMIN".equals(role.getName()) || "PO".equals(role.getName())));
        return administrator || teams.findFirstByProjectIdOrderByIdAsc(project.getId()).map(team -> inScope(user, team)).orElse(true);
    }

    public boolean hasMembers(Team team) {
        return team.getMembers().stream().anyMatch(TeamMember::isCurrentParticipant);
    }

    public boolean projectCanStart(Project project) {
        return project.getStatus() == ProjectStatus.PLANNING || project.getStatus() == ProjectStatus.ACTIVE;
    }
}
