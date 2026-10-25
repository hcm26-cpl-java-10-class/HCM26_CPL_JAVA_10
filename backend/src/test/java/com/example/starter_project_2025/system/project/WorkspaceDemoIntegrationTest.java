package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ActiveProfiles("demo-acceptance")
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:workspace_demo_acceptance;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver", "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.workspace.demo.enabled=true", "app.workspace.outbox.enabled=false",
        "GOOGLE_CLIENT_ID=test", "GOOGLE_CLIENT_SECRET=test"
})
@AutoConfigureMockMvc
@org.junit.jupiter.api.TestMethodOrder(org.junit.jupiter.api.MethodOrderer.OrderAnnotation.class)
class WorkspaceDemoIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired WorkspaceDemoDataService demo;
    @Autowired ProjectRepository projects;
    @Autowired TeamRepository teams;
    @Autowired TeamMemberRepository members;
    @Autowired WorkspaceRepository workspaces;
    @Autowired WorkspaceAuditRepository audits;
    @Autowired WorkspaceActivityRepository activities;
    @Autowired WorkspaceCreationRequestRepository requests;
    @Autowired UserRepository users;
    @Autowired UserDetailsService userDetails;
    @Autowired RefreshTokenService tokens;
    @Autowired TransactionTemplate tx;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired WorkspaceProjectConstraintInitializer constraints;
    @Autowired WorkspaceDemoDatasetRepository datasets;
    @Autowired ProjectTopicSnapshotRepository snapshots;
    @Autowired javax.sql.DataSource dataSource;

    @Test @org.junit.jupiter.api.Order(4) void manualSqlFixturesKeepSnapshotFixedAndRestoreOptionalText() {
        Long projectId = tx.execute(status -> teams.findByCodeAndTenantId("WS-DEMO-PIXEL",
                users.findByEmail("admin@example.com").orElseThrow().getTenant().getId()).orElseThrow().getProject().getId());
        String description = jdbc.queryForObject("SELECT description FROM project_topic_snapshots WHERE project_id = ?", String.class, projectId);
        String objectives = jdbc.queryForObject("SELECT objectives FROM project_topic_snapshots WHERE project_id = ?", String.class, projectId);
        java.util.function.Consumer<String> run = name -> new org.springframework.jdbc.datasource.init.ResourceDatabasePopulator(
                new org.springframework.core.io.FileSystemResource(java.nio.file.Path.of("../docs/us-prj-001-02", name)))
                .execute(dataSource);
        run.accept("AC02_SOURCE_SETUP.sql");
        assertThat(jdbc.queryForObject("SELECT version FROM us02_source_topics WHERE project_id = ?", String.class, projectId)).isEqualTo("v2.0.0");
        assertThat(jdbc.queryForObject("SELECT version FROM project_topic_snapshots WHERE project_id = ?", String.class, projectId)).isEqualTo("v1.0.0");
        run.accept("AC07_EMPTY_INFO_SETUP.sql");
        try {
            assertThat(jdbc.queryForObject("SELECT description FROM project_topic_snapshots WHERE project_id = ?", String.class, projectId)).isNull();
            assertThat(jdbc.queryForObject("SELECT objectives FROM project_topic_snapshots WHERE project_id = ?", String.class, projectId)).isNull();
        } finally { run.accept("AC07_EMPTY_INFO_RESTORE.sql"); }
        assertThat(jdbc.queryForObject("SELECT description FROM project_topic_snapshots WHERE project_id = ?", String.class, projectId)).isEqualTo(description);
        assertThat(jdbc.queryForObject("SELECT objectives FROM project_topic_snapshots WHERE project_id = ?", String.class, projectId)).isEqualTo(objectives);
    }

    private String token(String email) {
        return tx.execute(status -> {
            var principal = userDetails.loadUserByUsername(email);
            return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        });
    }
    private List<JsonNode> candidates(String email) throws Exception {
        var response = mvc.perform(get("/api/workspaces/candidates").header("Authorization", "Bearer " + token(email)))
                .andExpect(status().isOk()).andReturn().getResponse();
        var result = new ArrayList<JsonNode>();
        json.readTree(response.getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).forEach(result::add);
        return result;
    }
    private JsonNode team(List<JsonNode> rows, String code) {
        return rows.stream().filter(row -> code.equals(row.get("teamCode").asText())).findFirst().orElseThrow();
    }
    private Map<String, Long> counts() {
        return Map.of("projects", projects.count(), "teams", teams.count(), "members", members.count(), "workspaces", workspaces.count(),
                "audits", audits.count(), "activities", activities.count(), "requests", requests.count(), "users", users.count());
    }

    @Test @org.junit.jupiter.api.Order(1) void startupSeedsCreatedUncreatedIneligibleAndEmptyTeamsForAc04() throws Exception {
        String email = "admin@example.com";
        var rows = candidates(email);
        assertThat(rows).hasSize(5);
        assertThat(team(rows, "WS-DEMO-ATLAS").get("projectId").isNull()).isTrue();
        assertThat(team(rows, "WS-DEMO-ATLAS").get("eligibleForWorkspace").asBoolean()).isTrue();
        assertThat(team(rows, "WS-DEMO-NOVA").get("eligibleForWorkspace").asBoolean()).isTrue();
        assertThat(team(rows, "WS-DEMO-PIXEL").get("workspaceId").isNull()).isFalse();
        mvc.perform(get("/api/workspaces/{id}", team(rows, "WS-DEMO-PIXEL").get("workspaceId").asLong())
                .header("Authorization", "Bearer " + token(email))).andExpect(status().isOk());
        mvc.perform(get("/api/modules").param("size", "100").header("Authorization", "Bearer " + token(email)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[?(@.url == '/management/workspaces/candidates')].title")
                        .value(org.hamcrest.Matchers.contains("Workspace")));
        for (String code : List.of("WS-DEMO-TEAM-COMPLETED"))
            assertThat(team(rows, code).get("eligibleForWorkspace").asBoolean()).isFalse();
        var empty = team(rows, "WS-DEMO-EMPTY");
        assertThat(empty.get("memberCount").asInt()).isZero();
        assertThat(empty.get("cohortId").isNull()).isTrue();
        assertThat(empty.get("eligibleForWorkspace").asBoolean()).isFalse();
        assertThat(empty.get("ineligibleReason").asText()).contains("at least one active member");
        assertThat(rows).noneMatch(row -> "WS-DEMO-FOREIGN".equals(row.get("teamCode").asText()));
    }

    @Test @org.junit.jupiter.api.Order(4) void restartingDemoSeedDoesNotDuplicateOrOverwriteFixtures() {
        var before = counts();
        long snapshotCount = snapshots.count();
        demo.seed();
        demo.seed();
        assertThat(counts()).isEqualTo(before);
        assertThat(snapshots.count()).isEqualTo(snapshotCount);
    }

    @Test @org.junit.jupiter.api.Order(4) void standardAccountsHaveWorkspaceAccessWithoutExtraDemoAccounts() throws Exception {
        var rows = candidates("admin@example.com");
        long id = team(rows, "WS-DEMO-PIXEL").get("workspaceId").asLong();
        for (String email : List.of("teacher@example.com", "student@example.com")) {
            String accessToken = token(email);
            mvc.perform(get("/api/workspaces/{id}", id).header("Authorization", "Bearer " + accessToken))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.topic_snapshot.version").value("v1.0.0"))
                    .andExpect(jsonPath("$.member_count").value(1)).andExpect(jsonPath("$.can_view_members").value(true));
            mvc.perform(get("/api/workspaces/{id}/members", id).header("Authorization", "Bearer " + accessToken))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].project_role").value("UNASSIGNED"));
        }
        for (String email : List.of("workspace.member.demo@example.com", "workspace.mentor.demo@example.com", "workspace.viewer.demo@example.com"))
            users.findByEmail(email).ifPresent(user -> {
                assertThat(user.getIsActive()).isFalse();
                assertThat(user.getLocked()).isTrue();
            });
    }

    @Test @org.junit.jupiter.api.Order(4) void migrationRetiresOldLoginsAndPreservesWorkspaceHistoryAndRosterEdits() {
        Long pixelId = tx.execute(status -> teams.findByCodeAndTenantId("WS-DEMO-PIXEL",
                users.findByEmail("admin@example.com").orElseThrow().getTenant().getId()).orElseThrow().getId());
        Long workspaceId = tx.execute(status -> workspaces.findFirstByTeamIdOrderByIdAsc(pixelId).orElseThrow().getId());
        var historyCount = activities.count();
        Long legacyId = tx.execute(status -> {
            var student = users.findByEmail("student@example.com").orElseThrow();
            var legacy = new com.example.starter_project_2025.system.rbac.user.User();
            legacy.setEmail("workspace.member.demo@example.com"); legacy.setFirstName("Old");
            legacy.setPasswordHash("unused"); legacy.setTenant(student.getTenant()); users.saveAndFlush(legacy);
            var pixel = teams.findById(pixelId).orElseThrow(); pixel.setMentor(legacy);
            TeamMember row = new TeamMember(); row.setTeam(pixel); row.setUser(legacy); members.saveAndFlush(row);
            var existing = members.findByTeamIdAndUserId(pixelId, student.getId()).orElseThrow();
            existing.setProjectRole(ProjectRole.QA); existing.setParticipationStatus(ParticipationStatus.LEFT);
            return legacy.getId();
        });
        demo.seed();
        tx.executeWithoutResult(status -> {
            assertThat(users.findById(legacyId).orElseThrow().getIsActive()).isFalse();
            assertThat(users.findById(legacyId).orElseThrow().getLocked()).isTrue();
            var student = users.findByEmail("student@example.com").orElseThrow();
            var membership = members.findByTeamIdAndUserId(pixelId, student.getId()).orElseThrow();
            assertThat(membership.getParticipationStatus()).isEqualTo(ParticipationStatus.LEFT);
            assertThat(membership.getProjectRole()).isEqualTo(ProjectRole.QA);
            assertThat(members.findByTeamIdAndUserId(pixelId, legacyId).orElseThrow().getIsActive()).isFalse();
            assertThat(teams.findById(pixelId).orElseThrow().getMentor().getEmail()).isEqualTo("teacher@example.com");
        });
        assertThat(workspaces.findFirstByTeamIdOrderByIdAsc(pixelId).orElseThrow().getId()).isEqualTo(workspaceId);
        assertThat(activities.count()).isEqualTo(historyCount);
        demo.seed();
        tx.executeWithoutResult(status -> {
            var student = users.findByEmail("student@example.com").orElseThrow();
            var membership = members.findByTeamIdAndUserId(pixelId, student.getId()).orElseThrow();
            membership.setParticipationStatus(ParticipationStatus.ACTIVE);
            membership.setProjectRole(ProjectRole.UNASSIGNED);
        });
    }

    @Test @org.junit.jupiter.api.Order(5) void oldSharedProjectDemoIsReplacedOnceWithoutDeletingAuthoredData() throws Exception {
        Long tenantId = tx.execute(status -> users.findByEmail("admin@example.com").orElseThrow().getTenant().getId());
        var authored = tx.execute(status -> {
            var tenant = users.findByEmail("admin@example.com").orElseThrow().getTenant();
            Project project = new Project(); project.setCode("CUSTOM-PROJECT"); project.setName("Authored project"); project.setTenant(tenant); project.setStatus(ProjectStatus.PLANNING);
            projects.saveAndFlush(project);
            Team custom = new Team(); custom.setCode("CUSTOM-TEAM"); custom.setName("Authored team"); custom.setTenant(tenant); custom.setProject(project); teams.saveAndFlush(custom);
            return List.of(project.getId(), custom.getId());
        });
        List<Long> previousWorkspaceIds = workspaces.findAll().stream().map(Workspace::getId).toList();
        // Reproduce the previous many-teams-to-one-project fixture on the old schema.
        var projectConstraints = jdbc.queryForList("SELECT tc.CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc "
                + "JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k ON tc.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND tc.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA "
                + "WHERE tc.TABLE_NAME = 'TEAMS' AND tc.CONSTRAINT_TYPE IN ('UNIQUE', 'FOREIGN KEY') GROUP BY tc.CONSTRAINT_NAME "
                + "HAVING MAX(CASE WHEN k.COLUMN_NAME = 'PROJECT_ID' THEN 1 ELSE 0 END) = 1", String.class);
        for (String name : projectConstraints) jdbc.execute("ALTER TABLE teams DROP CONSTRAINT \"" + name.replace("\"", "\"\"") + "\"");
        // H2 may retain a removed unique index for a foreign key, so rebuild that FK with a non-unique index.
        for (String name : jdbc.queryForList("SELECT DISTINCT INDEX_NAME FROM INFORMATION_SCHEMA.INDEX_COLUMNS WHERE TABLE_NAME = 'TEAMS' AND COLUMN_NAME = 'PROJECT_ID'", String.class))
            jdbc.execute("DROP INDEX \"" + name.replace("\"", "\"\"") + "\"");
        jdbc.execute("ALTER TABLE teams ADD CONSTRAINT fk_legacy_team_project FOREIGN KEY (project_id) REFERENCES projects(id)");
        jdbc.update("INSERT INTO teams (code, name, tenant_id, project_id, is_active, created_at, updated_at) SELECT 'WS-DEMO-ORION', 'Legacy Orion', tenant_id, project_id, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP "
                + "FROM teams WHERE tenant_id = ? AND code = 'WS-DEMO-NOVA'", tenantId);
        jdbc.update("UPDATE workspace_demo_datasets SET version = 1 WHERE tenant_id = ?", tenantId);
        demo.seed();
        constraints.run();
        assertThat(teams.findByCodeAndTenantId("WS-DEMO-ORION", tenantId)).isEmpty();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM teams WHERE tenant_id = ? AND code LIKE 'WS-DEMO-%'", Long.class, tenantId)).isEqualTo(5);
        assertThat(workspaces.count()).isEqualTo(1);
        for (Long id : previousWorkspaceIds) {
            assertThat(workspaces.findById(id)).isEmpty();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspace_creation_requests WHERE workspace_id = ?", Long.class, id)).isZero();
        }
        assertThat(projects.findById(authored.get(0))).isPresent();
        assertThat(teams.findById(authored.get(1))).isPresent();
        assertThat(datasets.findById(tenantId).orElseThrow().getVersion()).isEqualTo(2);
        var before = counts();
        demo.seed();
        assertThat(counts()).isEqualTo(before);
        Long novaProject = tx.execute(status -> teams.findByCodeAndTenantId("WS-DEMO-NOVA", tenantId).orElseThrow().getProject().getId());
        assertThat(org.assertj.core.api.Assertions.catchThrowable(() -> tx.executeWithoutResult(status ->
                teams.findById(authored.get(1)).orElseThrow().setProject(projects.findById(novaProject).orElseThrow()))))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test @org.junit.jupiter.api.Order(2) void viewerHasExistingAndUncreatedRowsButCannotCreateOrSeeOtherScopes() throws Exception {
        String email = "student@example.com";
        var rows = candidates(email);
        assertThat(rows).hasSize(2);
        assertThat(team(rows, "WS-DEMO-ATLAS").get("workspaceId").isNull()).isTrue();
        assertThat(team(rows, "WS-DEMO-PIXEL").get("workspaceId").isNull()).isFalse();
        assertThat(rows).noneMatch(row -> Set.of("WS-DEMO-PRIVATE", "WS-DEMO-FOREIGN").contains(row.get("teamCode").asText()));
        mvc.perform(get("/api/workspaces/{id}", team(rows, "WS-DEMO-PIXEL").get("workspaceId").asLong())
                .header("Authorization", "Bearer " + token(email))).andExpect(status().isOk());
        var selected = team(candidates("admin@example.com"), "WS-DEMO-NOVA");
        mvc.perform(get("/api/workspaces/projects").param("teamId", selected.get("teamId").asText()).header("Authorization", "Bearer " + token(email)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/workspaces").header("Authorization", "Bearer " + token(email))
                .header("X-Idempotency-Key", UUID.randomUUID().toString()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("projectId", selected.get("projectId"), "teamId", selected.get("teamId")))))
                .andExpect(status().isForbidden());
    }

    @Test @org.junit.jupiter.api.Order(3) void selectedTeamProjectIsConfirmedBeforeAc06CreatesAndReopensWorkspace() throws Exception {
        String email = "teacher@example.com";
        var selected = team(candidates(email), "WS-DEMO-NOVA");
        var body = json.writeValueAsString(Map.of("projectId", selected.get("projectId"), "teamId", selected.get("teamId")));
        var before = counts();
        mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + token(email))
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.teamName").value("Team Nova"))
                .andExpect(jsonPath("$.projectName").value("Learning Resource Hub")).andExpect(jsonPath("$.cohortName").value("SE18A - Fall 2026"))
                .andExpect(jsonPath("$.memberCount").value(1));
        assertThat(counts()).isEqualTo(before);
        var created = mvc.perform(post("/api/workspaces").header("Authorization", "Bearer " + token(email))
                .header("X-Idempotency-Key", UUID.randomUUID().toString()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.sections.length()").value(8))
                .andExpect(jsonPath("$.createdBy").isNumber()).andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andReturn().getResponse();
        long id = json.readTree(created.getContentAsString()).get("id").asLong();
        for (int refresh = 0; refresh < 2; refresh++) {
            mvc.perform(get("/api/workspaces/{id}", id).header("Authorization", "Bearer " + token(email)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.teamName").value("Team Nova"))
                    .andExpect(jsonPath("$.projectName").value("Learning Resource Hub")).andExpect(jsonPath("$.sections.length()").value(8));
        }
        assertThat(team(candidates(email), "WS-DEMO-NOVA").get("workspaceId").asLong()).isEqualTo(id);
    }
}
