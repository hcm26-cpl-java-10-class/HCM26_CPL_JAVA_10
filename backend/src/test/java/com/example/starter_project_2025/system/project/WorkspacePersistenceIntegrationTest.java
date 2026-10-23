package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.StarterProject2025Application;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.support.GenericWebApplicationContext;
import org.springframework.mock.web.MockServletContext;
import java.nio.file.Path;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.assertj.core.api.Assertions.assertThat;

class WorkspacePersistenceIntegrationTest {
    @TempDir Path storage;

    private ConfigurableApplicationContext boot() {
        return new SpringApplicationBuilder(StarterProject2025Application.class).contextFactory(type -> {
            var context = new GenericWebApplicationContext();
            context.setServletContext(new MockServletContext());
            return context;
        }).run("--spring.profiles.active=test",
                "--spring.datasource.url=jdbc:h2:file:" + storage.resolve("workspace").toAbsolutePath().toString().replace('\\', '/'),
                "--spring.jpa.hibernate.ddl-auto=update", "--logging.level.root=WARN");
    }

    private void authenticate(ConfigurableApplicationContext context) {
        var principal = context.getBean(UserDetailsService.class).loadUserByUsername("admin@example.com");
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    @Test
    void workspaceSectionsAuditActivityAndIdempotencySurviveBackendRestart() {
        WorkspaceCreateRequest payload = new WorkspaceCreateRequest();
        WorkspaceResponse first;
        String key = UUID.randomUUID().toString();
        try (var context = boot()) {
            context.getBean(TransactionTemplate.class).executeWithoutResult(status -> {
                var tenant = context.getBean(UserRepository.class).findByEmail("admin@example.com").orElseThrow().getTenant();
                Project project = new Project();
                project.setCode("RESTART"); project.setName("Persistent project"); project.setStatus(ProjectStatus.ACTIVE); project.setTenant(tenant);
                context.getBean(ProjectRepository.class).saveAndFlush(project);
                Team team = new Team();
                team.setCode("RESTART"); team.setName("Persistent team"); team.setProject(project); team.setTenant(tenant);
                context.getBean(TeamRepository.class).saveAndFlush(team);
                TeamMember member = new TeamMember(); member.setTeam(team);
                member.setUser(context.getBean(UserRepository.class).findByEmail("admin@example.com").orElseThrow());
                context.getBean(TeamMemberRepository.class).saveAndFlush(member);
                payload.setProjectId(project.getId()); payload.setTeamId(team.getId());
            });
            authenticate(context);
            first = context.getBean(WorkspaceService.class).createWorkspace(key, payload);
            // Simulate the old schema and an already-created workspace whose project remained Planning.
            context.getBean(JdbcTemplate.class).update("UPDATE projects SET status = 'PLANNING' WHERE id = ?", payload.getProjectId());
            context.getBean(JdbcTemplate.class).execute("ALTER TABLE teams ALTER COLUMN project_id SET NOT NULL");
        } finally { SecurityContextHolder.clearContext(); }

        try (var context = boot()) {
            authenticate(context);
            var service = context.getBean(WorkspaceService.class);
            var detail = service.getWorkspace(first.getId());
            assertThat(detail.getSections()).hasSize(8);
            assertThat(detail.getActivities()).hasSize(1);
            assertThat(detail.getStatus()).isEqualTo(WorkspaceStatus.ACTIVE);
            assertThat(detail.getProjectStatus()).isEqualTo(ProjectStatus.ACTIVE);
            assertThat(service.createWorkspace(key, payload)).isEqualTo(first);
            assertThat(context.getBean(WorkspaceAuditRepository.class).findByWorkspaceId(first.getId())).hasSize(1);
            assertThat(context.getBean(WorkspaceOutboxRepository.class).findByWorkspaceId(first.getId())).hasSize(1);
            assertThat(context.getBean(WorkspaceRepository.class).count()).isEqualTo(1);
            context.getBean(TransactionTemplate.class).executeWithoutResult(status -> {
                Team unassigned = new Team();
                unassigned.setCode("UNASSIGNED-AFTER-UPGRADE"); unassigned.setName("No project after upgrade");
                unassigned.setTenant(context.getBean(UserRepository.class).findByEmail("admin@example.com").orElseThrow().getTenant());
                context.getBean(TeamRepository.class).saveAndFlush(unassigned);
                assertThat(unassigned.getProject()).isNull();
            });
        } finally { SecurityContextHolder.clearContext(); }
    }


}
