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
import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassRepository;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassStatus;
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
                var trainingClass = context.getBean(TrainingClassRepository.class).saveAndFlush(TrainingClass.builder()
                        .code("RESTART-CLASS").name("Persistent class").tenantId(tenant.getId())
                        .programId(tenant.getId()).status(TrainingClassStatus.ONGOING).build());
                var session = context.getBean(TeamAllocationSessionRepository.class).saveAndFlush(
                        TeamAllocationSession.builder().trainingClass(trainingClass).maxMembers(5)
                                .status(TeamAllocationSessionStatus.OPEN).build());
                var member = context.getBean(ClassMemberRepository.class).saveAndFlush(ClassMember.builder()
                        .trainingClass(trainingClass)
                        .user(context.getBean(UserRepository.class).findByEmail("admin@example.com").orElseThrow())
                        .status(ClassMemberStatus.ACTIVE).build());
                ProjectTeam team = context.getBean(ProjectTeamRepository.class).saveAndFlush(ProjectTeam.builder()
                        .trainingClass(trainingClass).allocationSession(session).project(project)
                        .teamName("Persistent team").maxMembers(5).status(ProjectTeamStatus.ACTIVE).build());
                context.getBean(ProjectMemberRepository.class).saveAndFlush(
                        ProjectMember.builder().team(team).classMember(member).role("UNASSIGNED").build());
                payload.setProjectId(project.getId()); payload.setTeamId(team.getId());
            });
            authenticate(context);
            first = context.getBean(WorkspaceService.class).createWorkspace(key, payload);
            context.getBean(JdbcTemplate.class).update("UPDATE projects SET status = 'PLANNING' WHERE id = ?", payload.getProjectId());
        } finally { SecurityContextHolder.clearContext(); }

        try (var context = boot()) {
            authenticate(context);
            var service = context.getBean(WorkspaceService.class);
            var detail = service.getWorkspace(first.getId());
            assertThat(detail.getSections()).hasSize(8);
            assertThat(detail.getActivities()).isNull();
            assertThat(context.getBean(WorkspaceSectionService.class).read(first.getId(), "activity").items()).hasSize(1);
            assertThat(detail.getStatus()).isEqualTo(WorkspaceStatus.ACTIVE);
            assertThat(detail.getProjectStatus()).isEqualTo(ProjectStatus.ACTIVE);
            assertThat(service.createWorkspace(key, payload)).isEqualTo(first);
            assertThat(context.getBean(WorkspaceAuditRepository.class).findByWorkspaceId(first.getId())).hasSize(1);
            assertThat(context.getBean(WorkspaceOutboxRepository.class).findByWorkspaceId(first.getId())).hasSize(1);
            assertThat(context.getBean(WorkspaceRepository.class).count()).isEqualTo(1);
            context.getBean(TransactionTemplate.class).executeWithoutResult(status -> {
                var tenant = context.getBean(UserRepository.class).findByEmail("admin@example.com").orElseThrow().getTenant();
                var trainingClass = context.getBean(TrainingClassRepository.class).findByCodeAndTenantId(
                        "RESTART-CLASS", tenant.getId()).orElseThrow();
                var session = context.getBean(TeamAllocationSessionRepository.class)
                        .findFirstByTrainingClass_IdOrderByIdAsc(trainingClass.getId()).orElseThrow();
                ProjectTeam unassigned = context.getBean(ProjectTeamRepository.class).saveAndFlush(ProjectTeam.builder()
                        .trainingClass(trainingClass).allocationSession(session).teamName("Unassigned after restart")
                        .maxMembers(5).status(ProjectTeamStatus.ACTIVE).build());
                assertThat(unassigned.getProject()).isNull();
            });
        } finally { SecurityContextHolder.clearContext(); }
    }


}
