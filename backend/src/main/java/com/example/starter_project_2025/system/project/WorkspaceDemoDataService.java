package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.HashSet;
import java.util.List;

/** Local acceptance fixtures, separate from the workspace creation flow. */
@Service
@RequiredArgsConstructor
public class WorkspaceDemoDataService {
    private final UserRepository users;
    private final RoleRepository roles;
    private final PermissionRepository permissions;
    private final PasswordEncoder passwords;
    private final CohortRepository cohorts;
    private final ProjectRepository projects;
    private final TeamRepository teams;
    private final TeamMemberRepository members;
    private final WorkspaceRepository workspaces;
    private final WorkspaceCreationTransaction creation;
    private final WorkspaceDemoResetService reset;
    @Value("${app.seed.admin.email:admin@example.com}") private String adminEmail;

    @Transactional
    public void seed() {
        User admin = users.findByEmail(adminEmail).orElseThrow();
        Tenant tenant = admin.getTenant();
        if (tenant == null || !Boolean.TRUE.equals(tenant.getActive()) || !Boolean.TRUE.equals(tenant.getIsActive())) return;
        reset.resetIfOutdated(tenant.getId());
        admin = users.findByEmail(adminEmail).orElseThrow();
        tenant = admin.getTenant();
        Role viewerRole = role("WORKSPACE_DEMO_VIEWER", List.of("MENU_READ", "WORKSPACE_READ"));
        Role creatorRole = role("WORKSPACE_DEMO_CREATOR", List.of("MENU_READ", "WORKSPACE_READ", "WORKSPACE_CREATE", "TEAM_READ", "TEAM_UPDATE"));
        User viewer = user("workspace.viewer.demo@example.com", "Sam", "Viewer", tenant, viewerRole);
        User mentor = user("workspace.mentor.demo@example.com", "Alex", "Mentor", tenant, creatorRole);
        User member = user("workspace.member.demo@example.com", "Taylor", "Member", tenant, roles.findByName("STUDENT").orElseThrow());
        Cohort first = cohort("WS-DEMO-COHORT-A", "SE18A - Fall 2026", tenant);
        project("WS-DEMO-PLANNING", "Campus Service Portal", ProjectStatus.PLANNING, tenant, first);
        team("WS-DEMO-ATLAS", "Team Atlas", null, tenant, mentor, List.of(viewer, mentor, member));
        Project active = project("WS-DEMO-ACTIVE", "Learning Resource Hub", ProjectStatus.ACTIVE, tenant, first);
        team("WS-DEMO-NOVA", "Team Nova", active, mentor, List.of(viewer, mentor, member));
        Project existing = project("WS-DEMO-EXISTING", "Student Support Portal", ProjectStatus.ACTIVE, tenant, first);
        Team existingTeam = team("WS-DEMO-PIXEL", "Team Pixel", existing, mentor, List.of(viewer, mentor, member));
        Project completed = project("WS-DEMO-COMPLETED", "Completed Project", ProjectStatus.COMPLETED, tenant, first);
        team("WS-DEMO-TEAM-COMPLETED", "Team Completed", completed, mentor, List.of(viewer, mentor));
        team("WS-DEMO-EMPTY", "Team Horizon", null, tenant, mentor, List.of());
        if (!workspaces.existsByProjectIdAndTeamId(existing.getId(), existingTeam.getId())) {
            var previous = SecurityContextHolder.getContext();
            var context = SecurityContextHolder.createEmptyContext();
            var principal = UserPrincipal.fromUser(admin);
            context.setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
            try {
                SecurityContextHolder.setContext(context);
                creation.create("workspace-demo-existing-" + existingTeam.getId(),
                        new WorkspaceCreateRequest(existing.getId(), existingTeam.getId()), "workspace-demo-seed");
            } finally { SecurityContextHolder.setContext(previous); }
        }
        reset.markCurrent(tenant.getId());
    }

    private Role role(String name, List<String> names) {
        return roles.findByName(name).orElseGet(() -> {
            Role role = new Role(); role.setName(name); role.setDescription("Local workspace acceptance demo");
            role.setPermissions(new HashSet<>(names.stream().map(item -> permissions.findByName(item).orElseThrow()).toList()));
            return roles.save(role);
        });
    }
    private User user(String email, String first, String last, Tenant tenant, Role role) {
        User result = users.findByEmail(email).orElseGet(() -> {
            User user = new User(); user.setEmail(email); user.setFirstName(first); user.setLastName(last);
            user.setPasswordHash(passwords.encode("password123")); user.setTenant(tenant); user.getRoles().add(role);
            return users.save(user);
        });
        if (result.getTenant() == null || !result.getTenant().getId().equals(tenant.getId()))
            throw new IllegalStateException("A reserved demo account belongs to another tenant. Demo setup was rolled back.");
        return result;
    }
    private Cohort cohort(String code, String name, Tenant tenant) {
        return cohorts.findByCodeAndTenantId(code, tenant.getId()).orElseGet(() -> {
            Cohort cohort = new Cohort(); cohort.setCode(code); cohort.setName(name); cohort.setTenant(tenant); cohort.setStatus(CohortStatus.ACTIVE);
            return cohorts.save(cohort);
        });
    }
    private Project project(String code, String name, ProjectStatus status, Tenant tenant, Cohort cohort) {
        return projects.findByCodeAndTenantId(code, tenant.getId()).orElseGet(() -> {
            Project project = new Project(); project.setCode(code); project.setName(name); project.setStatus(status); project.setTenant(tenant);
            project.setCohort(cohort); project.setDescription("Demo project for workspace acceptance: " + name + ".");
            return projects.save(project);
        });
    }
    private Team team(String code, String name, Project project, User mentor, List<User> initialMembers) {
        return team(code, name, project, project.getTenant(), mentor, initialMembers);
    }
    private Team team(String code, String name, Project project, Tenant tenant, User mentor, List<User> initialMembers) {
        return teams.findByCodeAndTenantId(code, tenant.getId()).orElseGet(() -> {
            Team team = new Team(); team.setCode(code); team.setName(name); team.setProject(project); team.setTenant(tenant); team.setMentor(mentor);
            teams.saveAndFlush(team);
            for (User user : initialMembers) {
                TeamMember member = new TeamMember(); member.setTeam(team); member.setUser(user); members.save(member);
                team.getMembers().add(member);
            }
            return team;
        });
    }
}
