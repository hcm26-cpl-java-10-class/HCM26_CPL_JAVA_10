package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Set;

/** Local fixtures reuse existing accounts; never create extra login identities. */
@Service
@RequiredArgsConstructor
public class WorkspaceDemoDataService {
    private final UserRepository users;
    private final RoleRepository roles;
    private final CohortRepository cohorts;
    private final ProjectRepository projects;
    private final TeamRepository teams;
    private final TeamMemberRepository members;
    private final WorkspaceRepository workspaces;
    private final ProjectTopicSnapshotRepository snapshots;
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
        User teacher = existingUser("teacher@example.com", tenant);
        User student = existingUser("student@example.com", tenant);
        if (admin.getUserCode() == null) admin.setUserCode("AD" + String.format("%06d", admin.getId()));
        if (teacher.getUserCode() == null) teacher.setUserCode("FE" + String.format("%06d", teacher.getId()));
        if (student.getUserCode() == null) student.setUserCode("SE" + String.format("%06d", student.getId()));
        retireLegacyAccounts(tenant, teacher, student, admin);

        Cohort first = cohort("WS-DEMO-COHORT-A", "SE18A - Fall 2026", tenant);
        project("WS-DEMO-PLANNING", "Campus Service Portal", ProjectStatus.PLANNING, tenant, first);
        team("WS-DEMO-ATLAS", "Team Atlas", null, tenant, teacher, List.of(student));
        Project active = project("WS-DEMO-ACTIVE", "Learning Resource Hub", ProjectStatus.ACTIVE, tenant, first);
        team("WS-DEMO-NOVA", "Team Nova", active, tenant, teacher, List.of(admin));
        Project existing = project("WS-DEMO-EXISTING", "Student Support Portal", ProjectStatus.ACTIVE, tenant, first);
        snapshot(active);
        snapshot(existing);
        Team existingTeam = team("WS-DEMO-PIXEL", "Team Pixel", existing, tenant, teacher, List.of(student));
        Project completed = project("WS-DEMO-COMPLETED", "Completed Project", ProjectStatus.COMPLETED, tenant, first);
        team("WS-DEMO-TEAM-COMPLETED", "Team Completed", completed, tenant, null, List.of(admin));
        team("WS-DEMO-EMPTY", "Team Horizon", null, tenant, teacher, List.of());
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

    private User existingUser(String email, Tenant tenant) {
        User user = users.findByEmail(email).orElseThrow(() ->
                new IllegalStateException("The existing student/teacher account is required for workspace fixtures."));
        if (user.getTenant() == null || !user.getTenant().getId().equals(tenant.getId()))
            throw new IllegalStateException("The existing student/teacher account belongs to another tenant.");
        return user;
    }

    private void retireLegacyAccounts(Tenant tenant, User teacher, User student, User admin) {
        Set<String> emails = Set.of("workspace.viewer.demo@example.com", "workspace.mentor.demo@example.com",
                "workspace.member.demo@example.com");
        var legacy = emails.stream().map(users::findByEmail).flatMap(java.util.Optional::stream)
                .filter(user -> user.getTenant() != null && user.getTenant().getId().equals(tenant.getId())).toList();
        var legacyIds = legacy.stream().map(User::getId).collect(java.util.stream.Collectors.toSet());
        for (Team team : teams.findAll()) {
            if (!team.getTenant().getId().equals(tenant.getId()) || !team.getCode().startsWith("WS-DEMO-")) continue;
            boolean migrated = false;
            if (team.getMentor() != null && legacyIds.contains(team.getMentor().getId())) {
                team.setMentor("WS-DEMO-TEAM-COMPLETED".equals(team.getCode()) ? null : teacher);
                migrated = true;
            }
            for (TeamMember row : members.findManagedRoster(team.getId())) {
                if (!legacyIds.contains(row.getUser().getId())) continue;
                row.setParticipationStatus(ParticipationStatus.LEFT);
                row.setIsActive(false);
                migrated = true;
            }
            if (migrated && !"WS-DEMO-EMPTY".equals(team.getCode())) {
                User replacement = Set.of("WS-DEMO-NOVA", "WS-DEMO-TEAM-COMPLETED").contains(team.getCode()) ? admin : student;
                // Migrate missing relationships; never reactivate a roster edited by the user.
                if (!members.existsByTeamIdAndUserId(team.getId(), replacement.getId())) {
                    TeamMember row = new TeamMember(); row.setTeam(team); row.setUser(replacement); members.save(row);
                }
            }
        }
        for (User user : legacy) { user.setIsActive(false); user.setLocked(true); }
        for (String name : List.of("WORKSPACE_DEMO_VIEWER", "WORKSPACE_DEMO_CREATOR"))
            roles.findByName(name).ifPresent(role -> role.setIsActive(false));
    }

    private void snapshot(Project project) {
        if (snapshots.findByProjectId(project.getId()).isPresent()) return;
        snapshots.save(ProjectTopicSnapshot.builder().project(project)
                .topicCode("TOPIC-" + project.getCode()).topicTitle(project.getName()).version("v1.0.0")
                .description(project.getDescription())
                .objectives("Deliver a working project through shared planning, implementation and review.")
                .requirementsJson("[\"Implement the agreed core user journeys.\",\"Include test evidence and setup documentation.\"]")
                .attachmentsJson("[]").build());
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
            project.setCohort(cohort); project.setDescription("Project for workspace acceptance: " + name + ".");
            return projects.save(project);
        });
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
