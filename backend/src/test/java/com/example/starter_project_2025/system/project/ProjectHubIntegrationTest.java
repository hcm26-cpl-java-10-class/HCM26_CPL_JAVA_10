package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.dto.ProjectHubDtos;
import com.example.starter_project_2025.system.project.team.Team;
import com.example.starter_project_2025.system.project.team.TeamMember;
import com.example.starter_project_2025.system.project.team.TeamMemberRepository;
import com.example.starter_project_2025.system.project.team.TeamRepository;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.core.io.FileSystemResource;
import javax.sql.DataSource;
import java.nio.file.Path;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:project_hub_tests;DB_CLOSE_DELAY=-1",
        "GOOGLE_CLIENT_ID=local-test-client", "GOOGLE_CLIENT_SECRET=local-test-secret"
})
@AutoConfigureMockMvc
class ProjectHubIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TransactionTemplate transaction;
    @Autowired UserRepository users;
    @Autowired TenantRepository tenants;
    @Autowired ProjectRepository projects;
    @Autowired TeamRepository teams;
    @Autowired TeamMemberRepository members;
    @Autowired WorkspaceRepository workspaces;
    @Autowired RoleRepository roles;
    @Autowired PermissionRepository permissions;
    @Autowired DataSource dataSource;
    @Autowired UserDetailsService userDetails;
    @Autowired RefreshTokenService tokens;
    @Autowired WorkspaceModuleCleanup moduleCleanup;
    @Autowired com.example.starter_project_2025.system.menu.module.ModuleRepository modules;
    @Autowired com.example.starter_project_2025.system.menu.module_groups.ModuleGroupRepository moduleGroups;

    private String adminToken;
    private String studentToken;
    private Team team;
    private Long teacherId;

    @BeforeEach
    void prepare() {
        transaction.executeWithoutResult(status -> {
            User admin = users.findByEmail("admin@example.com").orElseThrow();
            User student = users.findByEmail("student@example.com").orElseThrow();
            teacherId = users.findByEmail("teacher@example.com").orElseThrow().getId();
            Project project = new Project();
            project.setCode("TEST-" + UUID.randomUUID());
            project.setName("Campus portal");
            project.setDescription("A shared campus service portal");
            project.setTenant(admin.getTenant());
            project.setStatus(ProjectStatus.ACTIVE);
            projects.saveAndFlush(project);
            team = new Team();
            team.setCode("TEAM-" + UUID.randomUUID());
            team.setName("Integration team");
            team.setProject(project);
            team.setTenant(admin.getTenant());
            teams.saveAndFlush(team);
            TeamMember membership = new TeamMember();
            membership.setTeam(team);
            membership.setUser(student);
            members.saveAndFlush(membership);
            adminToken = token("admin@example.com");
            studentToken = token("student@example.com");
        });
    }

    private String token(String email) {
        var principal = userDetails.loadUserByUsername(email);
        return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    private String request() throws Exception {
        return json.writeValueAsString(Map.of("projectId", team.getProject().getId(), "teamId", team.getId()));
    }

    @Test
    void retiredBuilderEndpointsAreUnavailableAndLegacyMenuPermissionsAreInactive() throws Exception {
        mvc.perform(get("/api/project-hub/templates").header("Authorization", "Bearer " + adminToken)).andExpect(status().isNotFound());
        mvc.perform(post("/api/project-hub/templates").header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isNotFound());
        transaction.executeWithoutResult(status -> {
            var group = moduleGroups.findByName("Project Management").orElseThrow();
            var legacy = new com.example.starter_project_2025.system.menu.module.Module();
            legacy.setModuleGroup(group); legacy.setTitle("Project Templates"); legacy.setUrl("/management/project-templates");
            legacy.setRequiredPermission("PROJECT_TEMPLATE_READ"); modules.saveAndFlush(legacy);
            if (permissions.findByName("PROJECT_TEMPLATE_READ").isEmpty())
                permissions.saveAndFlush(com.example.starter_project_2025.system.rbac.permission.Permission.builder()
                        .name("PROJECT_TEMPLATE_READ").resource("PROJECT_TEMPLATE").action("READ").build());
        });
        moduleCleanup.run();
        moduleCleanup.run();
        assertThat(modules.findByUrl("/management/project-templates").orElseThrow().getIsActive()).isFalse();
        assertThat(permissions.findByName("PROJECT_TEMPLATE_READ").orElseThrow().getIsActive()).isFalse();
        assertThat(modules.findByUrl("/management/workspaces/candidates").orElseThrow().getIsActive()).isTrue();
    }

    private JsonNode createWorkspace(String key) throws Exception {
        String response = mvc.perform(post("/api/workspaces").header("Authorization", "Bearer " + adminToken)
                        .header("X-Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON).content(request()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(response);
    }

    @Test
    void confirmationDoesNotCreateAndDetailUsesExistingTeamData() throws Exception {
        long before = workspaces.count();
        mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content(request()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.teamId").value(team.getId()))
                .andExpect(jsonPath("$.memberCount").value(1));
        assertThat(workspaces.count()).isEqualTo(before);
        long id = createWorkspace(UUID.randomUUID().toString()).get("id").asLong();
        mvc.perform(get("/api/workspaces/{id}", id).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.projectName").value("Campus portal"))
                .andExpect(jsonPath("$.member_count").value(1))
                .andExpect(jsonPath("$.members").doesNotExist())
                .andExpect(jsonPath("$.createdByName").isNotEmpty());
        mvc.perform(get("/api/workspaces/{id}", id).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
    }

    @Test
    void retryReturnsSameWorkspaceAndDuplicateIsRejected() throws Exception {
        String key = UUID.randomUUID().toString();
        long id = createWorkspace(key).get("id").asLong();
        assertThat(createWorkspace(key).get("id").asLong()).isEqualTo(id);
        mvc.perform(post("/api/workspaces").header("Authorization", "Bearer " + adminToken)
                        .header("X-Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON).content(request()))
                .andExpect(status().isConflict());
    }

    @Test
    void mentorAssignmentAndCharterPersist() throws Exception {
        mvc.perform(put("/api/project-hub/teams/{id}/mentor", team.getId()).header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("mentorId", teacherId))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.mentorId").value(teacherId));
        String charter = json.writeValueAsString(new ProjectHubDtos.Charter("Ship a usable portal", "Tests pass", "Teams", "19:00–21:00", "Discuss with mentor"));
        mvc.perform(put("/api/project-hub/teams/{id}/charter", team.getId()).header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content(charter))
                .andExpect(status().isOk()).andExpect(jsonPath("$.charter.mission").value("Ship a usable portal"));
        long id = createWorkspace(UUID.randomUUID().toString()).get("id").asLong();
        mvc.perform(get("/api/workspaces/{id}", id).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.mentorName").isNotEmpty())
                .andExpect(jsonPath("$.charter.mission").value("Ship a usable portal"));
    }

    @Test
    void unassignedTeamRemainsVisibleAndCharterUsesSupportedChannelValues() throws Exception {
        transaction.executeWithoutResult(status -> teams.findById(team.getId()).orElseThrow().setProject(null));
        mvc.perform(get("/api/project-hub/teams").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.id == " + team.getId() + ")].projectName")
                        .value(org.hamcrest.Matchers.contains(org.hamcrest.Matchers.nullValue())));
        var valid = new ProjectHubDtos.Charter("Mission", "Tests pass", "Slack", "", "");
        mvc.perform(put("/api/project-hub/teams/{id}/charter", team.getId()).header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(valid)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.charter.primaryChannel").value("Slack")).andExpect(jsonPath("$.projectId").isEmpty());
        mvc.perform(put("/api/project-hub/teams/{id}/charter", team.getId()).header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new ProjectHubDtos.Charter("Changed mission", "", "Arbitrary text", "", ""))))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(get("/api/project-hub/teams").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.id == " + team.getId() + ")].charter.primaryChannel")
                        .value(org.hamcrest.Matchers.contains("Slack")));
    }


    @Test
    void foreignTenantTeamIsNotAccessible() throws Exception {
        long[] ids = transaction.execute(status -> {
            Tenant foreign = tenants.saveAndFlush(Tenant.builder().code("FOREIGN-" + UUID.randomUUID()).name("Other tenant").build());
            Project project = new Project();
            project.setCode("FOREIGN"); project.setName("Private project"); project.setStatus(ProjectStatus.ACTIVE); project.setTenant(foreign);
            projects.saveAndFlush(project);
            Team foreignTeam = new Team(); foreignTeam.setCode("FOREIGN"); foreignTeam.setName("Private team"); foreignTeam.setProject(project); foreignTeam.setTenant(foreign);
            teams.saveAndFlush(foreignTeam);
            return new long[]{project.getId(), foreignTeam.getId()};
        });
        mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("projectId", ids[0], "teamId", ids[1]))))
                .andExpect(status().isForbidden());
    }

    @Test
    void workspaceWritesEnforceAuthenticationAndPermissions() throws Exception {
        mvc.perform(get("/api/workspaces/candidates")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/workspaces").header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON).content(request())).andExpect(status().isForbidden());
        mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + studentToken)
                .contentType(MediaType.APPLICATION_JSON).content(request())).andExpect(status().isForbidden());
    }

    @Test
    void studentScopeUsesSharedTenantAndOnlyShowsMemberships() throws Exception {
        Long outsideTeamId = transaction.execute(status -> {
            User student = users.findByEmail("student@example.com").orElseThrow();
            Role viewer = new Role();
            viewer.setName("TEST_VIEWER_" + UUID.randomUUID());
            viewer.setPermissions(new java.util.HashSet<>(List.of(permissions.findByName("WORKSPACE_READ").orElseThrow())));
            roles.saveAndFlush(viewer);
            student.getRoles().add(viewer);
            users.saveAndFlush(student);
            Team outside = new Team();
            outside.setCode("OUTSIDE-" + UUID.randomUUID()); outside.setName("Outside team");
            outside.setTenant(student.getTenant());
            return teams.saveAndFlush(outside).getId();
        });
        JsonNode response = json.readTree(mvc.perform(get("/api/workspaces/candidates").header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        java.util.List<Long> ids = new java.util.ArrayList<>();
        response.forEach(row -> ids.add(row.get("teamId").asLong()));
        assertThat(ids).contains(team.getId()).doesNotContain(outsideTeamId);
    }

    @Test
    void inactiveTenantCannotReadWorkspaceOrProjectHub() throws Exception {
        Long tenantId = transaction.execute(status -> users.findByEmail("admin@example.com").orElseThrow().getTenant().getId());
        transaction.executeWithoutResult(status -> tenants.findById(tenantId).orElseThrow().setActive(false));
        try {
            mvc.perform(get("/api/workspaces/candidates").header("Authorization", "Bearer " + adminToken)).andExpect(status().isForbidden());
            mvc.perform(get("/api/project-hub/teams").header("Authorization", "Bearer " + adminToken)).andExpect(status().isForbidden());
        } finally {
            transaction.executeWithoutResult(status -> tenants.findById(tenantId).orElseThrow().setActive(true));
        }
    }

    @Test
    void optionalLocalFixtureCanRunTwiceWithoutCreatingWorkspace() {
        Path repository = Path.of(System.getProperty("user.dir")).toAbsolutePath();
        if (repository.getFileName().toString().equals("backend")) repository = repository.getParent();
        var fixture = new ResourceDatabasePopulator(new FileSystemResource(repository.resolve("docs/project-hub-demo.sql")));
        long workspaceCount = workspaces.count();
        fixture.execute(dataSource);
        fixture.execute(dataSource);
        var jdbc = new JdbcTemplate(dataSource);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM teams WHERE code = 'LOCAL-DEMO-TEAM'", Long.class)).isEqualTo(1L);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE t.code = 'LOCAL-DEMO-TEAM'", Long.class)).isEqualTo(2L);
        assertThat(workspaces.count()).isEqualTo(workspaceCount);
    }
}
