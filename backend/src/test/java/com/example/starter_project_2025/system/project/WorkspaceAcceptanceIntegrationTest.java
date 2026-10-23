package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
class WorkspaceAcceptanceIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TransactionTemplate tx;
    @Autowired JdbcTemplate jdbc;
    @Autowired TenantRepository tenants;
    @Autowired ProjectRepository projects;
    @Autowired CohortRepository cohorts;
    @Autowired TeamRepository teams;
    @Autowired TeamMemberRepository members;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired PermissionRepository permissions;
    @Autowired UserDetailsService userDetails;
    @Autowired RefreshTokenService tokens;
    @Autowired JwtEncoder encoder;
    @Autowired WorkspaceOutboxDelivery delivery;
    @SpyBean WorkspaceRepository workspaces;
    @SpyBean WorkspaceAuditRepository audits;
    @SpyBean WorkspaceOutboxRepository outbox;
    @SpyBean WorkspaceActivityRepository activities;
    @SpyBean WorkspaceCreationRequestRepository requests;
    Long tenantId, projectId, teamId, cohortId, actorId, roleId, membershipId;
    String token, email;

    @BeforeEach
    void fixture() {
        tx.executeWithoutResult(status -> {
            Tenant tenant = tenants.saveAndFlush(Tenant.builder().code("AC-" + UUID.randomUUID()).name("Acceptance tenant").build());
            tenantId = tenant.getId();
            Role role = new Role();
            role.setName("WORKSPACE_MEMBER_" + UUID.randomUUID());
            role.setPermissions(new HashSet<>(List.of(permissions.findByName("VIEW_PROJECT_WORKSPACE").orElseThrow(),
                    permissions.findByName("CREATE_PROJECT_WORKSPACE").orElseThrow())));
            roleId = roles.saveAndFlush(role).getId();
            email = UUID.randomUUID() + "@workspace.test";
            User actor = new User();
            actor.setEmail(email); actor.setFirstName("Workspace"); actor.setLastName("Creator");
            actor.setPasswordHash("unused-test-password"); actor.setTenant(tenant); actor.setRoles(new HashSet<>(Set.of(role)));
            actorId = users.saveAndFlush(actor).getId();
            Cohort cohort = new Cohort();
            cohort.setCode("COHORT-" + UUID.randomUUID()); cohort.setName("SE18A"); cohort.setTenant(tenant); cohort.setStatus(CohortStatus.ACTIVE);
            cohortId = cohorts.saveAndFlush(cohort).getId();
            Project project = new Project();
            project.setCode("PRJ-" + UUID.randomUUID()); project.setName("Campus portal"); project.setDescription("Existing project brief");
            project.setTenant(tenant); project.setCohort(cohort); project.setStatus(ProjectStatus.PLANNING);
            projectId = projects.saveAndFlush(project).getId();
            Team team = new Team();
            team.setCode("TEAM-" + UUID.randomUUID()); team.setName("Atlas"); team.setTenant(tenant); team.setProject(project);
            teamId = teams.saveAndFlush(team).getId();
            TeamMember member = new TeamMember();
            member.setTeam(team); member.setUser(actor);
            membershipId = members.saveAndFlush(member).getId();
            token = token(email);
        });
        assertCleanCreationState();
    }

    void assertCleanCreationState() {
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspaces WHERE project_id = ? AND team_id = ?", Long.class, projectId, teamId)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspace_creation_requests WHERE tenant_id = ? AND actor_id = ?", Long.class, tenantId, actorId)).isZero();
    }

    @AfterEach
    void cleanupWorkspaceRecords() {
        if (tenantId == null) return;
        tx.executeWithoutResult(status -> {
            for (String table : List.of("workspace_creation_requests", "workspace_activities", "workspace_audits", "workspace_outbox_events", "workspace_sections"))
                jdbc.update("DELETE FROM " + table + " WHERE workspace_id IN (SELECT id FROM workspaces WHERE tenant_id = ?)", tenantId);
            jdbc.update("DELETE FROM workspaces WHERE tenant_id = ?", tenantId);
        });
        assertCleanCreationState();
    }

    String token(String username) {
        var principal = userDetails.loadUserByUsername(username);
        return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }
    String body() throws Exception { return body(projectId, teamId); }
    String body(Long project, Long team) throws Exception { return json.writeValueAsString(Map.of("projectId", project, "teamId", team)); }
    MvcResult create(String key, String payload) throws Exception {
        return mvc.perform(post("/api/workspaces").header("Authorization", "Bearer " + token)
                .header("X-Idempotency-Key", key).header("X-Correlation-ID", "acceptance-correlation")
                .contentType(MediaType.APPLICATION_JSON).content(payload)).andReturn();
    }
    JsonNode created(String key) throws Exception {
        var result = create(key, body());
        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).isEqualTo(201);
        return json.readTree(result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
    }
    void confirm() throws Exception {
        mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body())).andExpect(status().isOk());
    }
    Map<String, Long> creationCounts() {
        var counts = new LinkedHashMap<String, Long>();
        for (String table : List.of("workspaces", "workspace_sections", "workspace_audits", "workspace_outbox_events",
                "workspace_activities", "workspace_creation_requests"))
            counts.put(table, jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Long.class));
        return counts;
    }

    Long unassignedTeam() {
        return unassignedTeam(true);
    }
    Long unassignedTeam(boolean withMember) {
        return tx.execute(status -> {
            Team team = new Team();
            team.setCode("UNASSIGNED-" + UUID.randomUUID()); team.setName("Unassigned " + UUID.randomUUID());
            team.setTenant(tenants.findById(tenantId).orElseThrow()); team.setMentor(users.findById(actorId).orElseThrow());
            teams.saveAndFlush(team);
            if (withMember) {
                TeamMember member = new TeamMember(); member.setTeam(team); member.setUser(users.findById(actorId).orElseThrow());
                members.saveAndFlush(member);
            }
            return team.getId();
        });
    }


    @Test void unassignedTeamChoosesAnyFreeProjectAndBindsOnlyOnCommit() throws Exception {
        tx.executeWithoutResult(status -> teams.findById(teamId).orElseThrow().setProject(null));
        Long unassigned = unassignedTeam();
        var before = creationCounts();
        mvc.perform(get("/api/workspaces/candidates").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.teamId == " + unassigned + ")].projectId").value(org.hamcrest.Matchers.contains(org.hamcrest.Matchers.nullValue())));
        mvc.perform(get("/api/workspaces/candidates/page").param("onlyUncreated", "true").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[?(@.teamId == " + unassigned + ")].projectId").value(org.hamcrest.Matchers.contains(org.hamcrest.Matchers.nullValue())));
        mvc.perform(get("/api/workspaces/projects").param("teamId", unassigned.toString()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.projectId == " + projectId + ")].name").value(org.hamcrest.Matchers.contains("Campus portal")));
        mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body(projectId, unassigned)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.projectId").value(projectId)).andExpect(jsonPath("$.eligibleForWorkspace").value(true));
        tx.executeWithoutResult(status -> {
            assertThat(teams.findById(unassigned).orElseThrow().getProject()).isNull();
            assertThat(projects.findById(projectId).orElseThrow().getStatus()).isEqualTo(ProjectStatus.PLANNING);
        });
        assertThat(creationCounts()).isEqualTo(before);
        var created = create("bind-project", body(projectId, unassigned));
        assertThat(created.getResponse().getStatus()).isEqualTo(201);
        tx.executeWithoutResult(status -> {
            assertThat(teams.findById(unassigned).orElseThrow().getProject().getId()).isEqualTo(projectId);
            assertThat(projects.findById(projectId).orElseThrow().getStatus()).isEqualTo(ProjectStatus.ACTIVE);
        });
        mvc.perform(get("/api/workspaces/projects").param("teamId", teamId.toString()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.projectId == " + projectId + ")]").isEmpty());
        assertThat(create("occupied-project", body()).getResponse().getStatus()).isEqualTo(422);
        assertThat(create("duplicate-team", body(projectId, unassigned)).getResponse().getStatus()).isEqualTo(409);
    }

    @Test void projectIsReservedForItsTeamEvenBeforeWorkspaceExists() throws Exception {
        Long otherTeam = unassignedTeam();
        var before = creationCounts();
        mvc.perform(get("/api/workspaces/projects").param("teamId", otherTeam.toString()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.projectId == " + projectId + ")]").isEmpty());
        mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body(projectId, otherTeam)))
                .andExpect(status().isUnprocessableEntity());
        assertThat(create("reserved-project", body(projectId, otherTeam)).getResponse().getStatus()).isEqualTo(422);
        assertThat(creationCounts()).isEqualTo(before);
        assertThatThrownBy(() -> tx.executeWithoutResult(status -> teams.findById(otherTeam).orElseThrow()
                .setProject(projects.findById(projectId).orElseThrow()))).isInstanceOf(DataIntegrityViolationException.class);
        tx.executeWithoutResult(status -> assertThat(teams.findById(otherTeam).orElseThrow().getProject()).isNull());
        assertThat(created("owner-project").get("projectId").asLong()).isEqualTo(projectId);
    }

    @Test void teamWithAssignedProjectCannotSelectAnotherProject() throws Exception {
        mvc.perform(get("/api/workspaces/projects").param("teamId", teamId.toString()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].projectId").value(projectId));
        Long otherProject = tx.execute(status -> {
            Project project = new Project(); project.setName("Other project"); project.setCode("OTHER-" + UUID.randomUUID());
            project.setTenant(tenants.findById(tenantId).orElseThrow()); project.setStatus(ProjectStatus.PLANNING);
            return projects.saveAndFlush(project).getId();
        });
        mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body(otherProject, teamId))).andExpect(status().isUnprocessableEntity());
        assertThat(create("replace-project", body(otherProject, teamId)).getResponse().getStatus()).isEqualTo(422);
    }

    @Test void emptyTeamCannotConfirmOrCreateWithProject() throws Exception {
        Long emptyTeam = unassignedTeam(false);
        tx.executeWithoutResult(status -> teams.findById(teamId).orElseThrow().setProject(null));
        var before = creationCounts();
        long projectCount = projects.count();
        mvc.perform(get("/api/workspaces/candidates").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.teamId == " + emptyTeam + ")].eligibleForWorkspace").value(org.hamcrest.Matchers.contains(false)));
        for (String payload : List.of(body(projectId, emptyTeam))) {
            mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(payload))
                    .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("at least one active member")));
            assertThat(create(UUID.randomUUID().toString(), payload).getResponse().getStatus()).isEqualTo(422);
        }
        assertThat(projects.count()).isEqualTo(projectCount);
        assertThat(creationCounts()).isEqualTo(before);
        tx.executeWithoutResult(status -> assertThat(teams.findById(emptyTeam).orElseThrow().getProject()).isNull());
    }

    @Test void removingLastActiveMemberAfterConfirmationBlocksCreation() throws Exception {
        confirm();
        var before = creationCounts();
        tx.executeWithoutResult(status -> members.findById(membershipId).orElseThrow().setIsActive(false));
        tx.executeWithoutResult(status -> teams.findById(teamId).orElseThrow().setMentor(users.findById(actorId).orElseThrow()));
        assertThat(create("last-member-removed", body()).getResponse().getStatus()).isEqualTo(422);
        assertThat(creationCounts()).isEqualTo(before);
        tx.executeWithoutResult(status -> assertThat(projects.findById(projectId).orElseThrow().getStatus()).isEqualTo(ProjectStatus.PLANNING));
    }




    @Test void twoTeamsRacingForSameProjectProduceOnlyOneWorkspace() throws Exception {
        tx.executeWithoutResult(status -> teams.findById(teamId).orElseThrow().setProject(null));
        Long otherTeam = unassignedTeam();
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> { ready.countDown(); start.await(); return create("race-original", body()); });
            var second = executor.submit(() -> { ready.countDown(); start.await(); return create("race-other", body(projectId, otherTeam)); });
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(List.of(first.get(20, TimeUnit.SECONDS).getResponse().getStatus(), second.get(20, TimeUnit.SECONDS).getResponse().getStatus()))
                    .containsExactlyInAnyOrder(201, 422);
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspaces WHERE project_id = ?", Long.class, projectId)).isEqualTo(1);
    }

    @Test
    void ac05ConfirmationReloadsSelectedPairAndWritesNothing() throws Exception {
        var before = creationCounts();
        mvc.perform(get("/api/workspaces/candidates").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].teamName").value("Atlas"));
        tx.executeWithoutResult(status -> teams.findById(teamId).orElseThrow().setName("Renamed after list"));
        mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(body()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.projectId").value(projectId))
                .andExpect(jsonPath("$.teamId").value(teamId)).andExpect(jsonPath("$.teamName").value("Renamed after list"))
                .andExpect(jsonPath("$.cohortName").value("SE18A")).andExpect(jsonPath("$.memberCount").value(1));
        assertThat(creationCounts()).isEqualTo(before);
    }

    @Test
    void ac06CreatesActiveProjectAndWorkspaceWithEightSectionsAndNoSampleData() throws Exception {
        Map<String, Long> before = new HashMap<>();
        for (String table : jdbc.queryForList("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'PUBLIC' AND TABLE_TYPE = 'BASE TABLE'", String.class)) {
            if (!table.toLowerCase(Locale.ROOT).startsWith("workspace") && !table.equalsIgnoreCase("workspaces"))
                before.put(table, jdbc.queryForObject("SELECT COUNT(*) FROM \"" + table + "\"", Long.class));
        }
        var response = created(UUID.randomUUID().toString());
        long id = response.get("id").asLong();
        assertThat(response.get("status").asText()).isEqualTo("ACTIVE");
        assertThat(response.get("tenantId").asLong()).isEqualTo(tenantId);
        assertThat(response.get("createdBy").asLong()).isEqualTo(actorId);
        assertThat(response.get("createdAt").asText()).isNotBlank();
        assertThat(response.get("sections")).hasSize(8);
        tx.executeWithoutResult(status -> {
            assertThat(workspaces.findById(id).orElseThrow().getSections()).containsExactly(WorkspaceSection.values());
            assertThat(projects.findById(projectId).orElseThrow().getStatus()).isEqualTo(ProjectStatus.ACTIVE);
        });
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspace_sections WHERE workspace_id = ?", Long.class, id)).isEqualTo(8L);
        before.forEach((table, count) -> assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM \"" + table + "\"", Long.class)).as(table).isEqualTo(count));
        for (int refresh = 0; refresh < 2; refresh++) {
            mvc.perform(get("/api/workspaces/{id}", id).header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id))
                    .andExpect(jsonPath("$.sections.length()").value(8)).andExpect(jsonPath("$.members.length()").value(1))
                    .andExpect(jsonPath("$.activities.length()").value(1));
        }
        tx.executeWithoutResult(status -> members.findById(membershipId).orElseThrow().setIsActive(false));
        tx.executeWithoutResult(status -> teams.findById(teamId).orElseThrow().setMentor(users.findById(actorId).orElseThrow()));
        mvc.perform(get("/api/workspaces/{id}", id).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.members.length()").value(0));
    }

    @Test
    void ac08DifferentKeyReturnsExistingWorkspaceAndDatabaseAlsoEnforcesUniqueness() throws Exception {
        long id = created("first").get("id").asLong();
        var before = creationCounts();
        var conflict = create("another", body());
        assertThat(conflict.getResponse().getStatus()).isEqualTo(409);
        var error = json.readTree(conflict.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        assertThat(error.get("message").asText()).isEqualTo("This team already has a workspace");
        assertThat(error.get("workspaceId").asLong()).isEqualTo(id);
        assertThatThrownBy(() -> tx.executeWithoutResult(status -> {
            var original = workspaces.findById(id).orElseThrow();
            Workspace duplicate = new Workspace();
            duplicate.setTenant(original.getTenant()); duplicate.setProject(original.getProject()); duplicate.setTeam(original.getTeam());
            duplicate.setCode("DUPLICATE"); duplicate.setName("Duplicate"); duplicate.setStatus(WorkspaceStatus.ACTIVE);
            workspaces.saveAndFlush(duplicate);
        })).isInstanceOf(DataIntegrityViolationException.class);
        assertThat(creationCounts()).isEqualTo(before);
    }

    @Test
    void ac09ReplayIsDurableAndDifferentPayloadConflicts() throws Exception {
        assertCleanCreationState();
        var first = created("durable-key");
        var before = creationCounts();
        assertThat(created("durable-key")).isEqualTo(first);
        // A fresh service instance must recover the response solely from database records.
        var freshService = new WorkspaceIdempotencyService(requests, json);
        assertThat(freshService.response(freshService.find(tenantId, actorId, "durable-key")).getId()).isEqualTo(first.get("id").asLong());
        assertThat(create("durable-key", body(projectId, Long.MAX_VALUE)).getResponse().getStatus()).isEqualTo(409);
        assertThat(creationCounts()).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void ac10ConcurrentRequestsProduceOnlyOneLogicalCreation(boolean sameKey) throws Exception {
        assertCleanCreationState();
        String payload = body();
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            List<Future<MvcResult>> futures = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                String key = sameKey ? "parallel-shared" : "parallel-" + i;
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Concurrent test start timed out");
                    return create(key, payload);
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            var first = futures.get(0).get(20, TimeUnit.SECONDS);
            var second = futures.get(1).get(20, TimeUnit.SECONDS);
            assertThat(List.of(first.getResponse().getStatus(), second.getResponse().getStatus()))
                    .containsExactlyInAnyOrderElementsOf(sameKey ? List.of(201, 201) : List.of(201, 409));
            if (sameKey) assertThat(json.readTree(first.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8))).isEqualTo(json.readTree(second.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)));
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspaces WHERE project_id = ? AND team_id = ?", Long.class, projectId, teamId)).isEqualTo(1L);
        long id = workspaces.findByProjectIdAndTeamId(projectId, teamId).orElseThrow().getId();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspace_creation_requests WHERE tenant_id = ? AND actor_id = ?", Long.class, tenantId, actorId)).isEqualTo(1L);
        assertThat(audits.findByWorkspaceId(id)).hasSize(1);
        assertThat(outbox.findByWorkspaceId(id)).hasSize(1);
        assertThat(activities.findByWorkspaceIdOrderByOccurredAtDesc(id)).hasSize(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"COMPLETED", "CANCELLED", "DRAFT"})
    void ac11RejectsProjectStatusChangedSinceConfirmation(String status) throws Exception {
        confirm();
        var before = creationCounts();
        tx.executeWithoutResult(transaction -> projects.findById(projectId).orElseThrow().setStatus(ProjectStatus.valueOf(status)));
        assertThat(create("changed-status", body()).getResponse().getStatus()).isEqualTo(409);
        assertThat(creationCounts()).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(strings = {"TENANT", "PERMISSION", "SCOPE", "ACCOUNT", "ROLE"})
    void ac11RechecksRevocationSinceConfirmation(String change) throws Exception {
        confirm();
        var before = creationCounts();
        tx.executeWithoutResult(status -> {
            switch (change) {
                case "TENANT" -> tenants.findById(tenantId).orElseThrow().setActive(false);
                case "PERMISSION" -> roles.findById(roleId).orElseThrow().getPermissions().clear();
                case "SCOPE" -> members.deleteById(membershipId);
                case "ACCOUNT" -> users.findById(actorId).orElseThrow().setIsActive(false);
                case "ROLE" -> roles.findById(roleId).orElseThrow().setIsActive(false);
            }
        });
        assertThat(create("revoked", body()).getResponse().getStatus()).isEqualTo(403);
        assertThat(creationCounts()).isEqualTo(before);
    }

    @Test
    void ac11ExpiredSessionIs401AndWritesNothing() throws Exception {
        confirm();
        var before = creationCounts();
        token = encoder.encode(JwtEncoderParameters.from(JwtClaimsSet.builder().subject(email)
                .issuedAt(Instant.now().minusSeconds(7200)).expiresAt(Instant.now().minusSeconds(3600))
                .claim("type", "access").build())).getTokenValue();
        assertThat(create("expired", body()).getResponse().getStatus()).isEqualTo(401);
        assertThat(creationCounts()).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(strings = {"TEAM", "PROJECT"})
    void ac11MissingTargetIs404(String target) throws Exception {
        confirm();
        var before = creationCounts();
        tx.executeWithoutResult(status -> {
            members.deleteById(membershipId);
            teams.deleteById(teamId); teams.flush();
            if ("PROJECT".equals(target)) projects.deleteById(projectId);
        });
        assertThat(create("removed", body()).getResponse().getStatus()).isEqualTo(404);
        assertThat(creationCounts()).isEqualTo(before);
    }

    @Test
    void ac11InvalidSelection422AndForeignTenant403() throws Exception {
        confirm();
        var before = creationCounts();
        Long otherProject = tx.execute(status -> {
            var original = projects.findById(projectId).orElseThrow();
            Project project = new Project();
            project.setName("Other"); project.setCode("OTHER"); project.setTenant(original.getTenant()); project.setStatus(ProjectStatus.ACTIVE);
            return projects.saveAndFlush(project).getId();
        });
        assertThat(create("invalid-selection", body(otherProject, teamId)).getResponse().getStatus()).isEqualTo(422);
        tx.executeWithoutResult(status -> {
            var foreign = tenants.saveAndFlush(Tenant.builder().code("OTHER-" + UUID.randomUUID()).name("Other").build());
            projects.findById(projectId).orElseThrow().setTenant(foreign);
            teams.findById(teamId).orElseThrow().setTenant(foreign);
        });
        assertThat(create("foreign-tenant", body()).getResponse().getStatus()).isEqualTo(403);
        assertThat(creationCounts()).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(strings = {"WORKSPACE", "SECTIONS", "AUDIT", "OUTBOX", "ACTIVITY", "IDEMPOTENCY"})
    void ac12MandatorySaveFailureRollsEverythingBackAndSameKeyCanRetry(String step) throws Exception {
        confirm();
        var before = creationCounts();
        var failure = new IllegalStateException("Injected mandatory save failure");
        switch (step) {
            case "WORKSPACE" -> doThrow(failure).when(workspaces).saveAndFlush(any(Workspace.class));
            case "SECTIONS" -> doAnswer(invocation -> {
                WorkspaceAudit audit = invocation.getArgument(0);
                jdbc.update("INSERT INTO workspace_sections (workspace_id, display_order, section) VALUES (?, 99, 'OVERVIEW')", audit.getWorkspaceId());
                return null;
            }).when(audits).saveAndFlush(any(WorkspaceAudit.class));
            case "AUDIT" -> doThrow(failure).when(audits).saveAndFlush(any(WorkspaceAudit.class));
            case "OUTBOX" -> doThrow(failure).when(outbox).saveAndFlush(any(WorkspaceOutboxEvent.class));
            case "ACTIVITY" -> doThrow(failure).when(activities).saveAndFlush(any(WorkspaceActivity.class));
            case "IDEMPOTENCY" -> doThrow(failure).when(requests).saveAndFlush(any(WorkspaceCreationRequest.class));
        }
        assertThat(create("retry-after-rollback", body()).getResponse().getStatus()).isEqualTo(500);
        assertThat(creationCounts()).isEqualTo(before);
        tx.executeWithoutResult(status -> assertThat(projects.findById(projectId).orElseThrow().getStatus()).isEqualTo(ProjectStatus.PLANNING));
        reset(workspaces, audits, outbox, activities, requests);
        assertThat(created("retry-after-rollback").get("status").asText()).isEqualTo("ACTIVE");
    }

    @Test
    void ac12AuditHasFullContextAndOutboxRedeliveryNeverDuplicatesActivity() throws Exception {
        var response = created("audit");
        long id = response.get("id").asLong();
        var audit = audits.findByWorkspaceId(id).getFirst();
        assertThat(audit.getActorId()).isEqualTo(actorId);
        assertThat(audit.getTenantId()).isEqualTo(tenantId);
        assertThat(audit.getProjectId()).isEqualTo(projectId);
        assertThat(audit.getTeamId()).isEqualTo(teamId);
        assertThat(audit.getCreatedAt()).isNotNull();
        assertThat(audit.getAction()).isEqualTo("WORKSPACE_CREATED");
        assertThat(audit.getCorrelationId()).isEqualTo("acceptance-correlation");
        assertThat(audit.getBeforeJson()).isEqualTo("null");
        assertThat(json.readTree(audit.getAfterJson())).isEqualTo(response);
        var event = outbox.findByWorkspaceId(id).getFirst();
        assertThat(event.getEventId()).isEqualTo(audit.getEventId());
        delivery.deliver(event.getId());
        tx.executeWithoutResult(status -> outbox.findById(event.getId()).orElseThrow().setDeliveredAt(null));
        delivery.deliver(event.getId());
        delivery.deliver(event.getId());
        assertThat(activities.findByWorkspaceIdOrderByOccurredAtDesc(id)).hasSize(1);
        assertThat(outbox.findById(event.getId()).orElseThrow().getDeliveredAt()).isNotNull();
        mvc.perform(get("/api/workspaces/{id}", id).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.activities[0].eventId").value(event.getEventId()))
                .andExpect(jsonPath("$.activities[0].actorName").value("Workspace Creator"));
    }

    @Test
    void ac01And02ScopeFiltersAndCountsAgreeWithoutDuplicates() throws Exception {
        Long outside = tx.execute(status -> {
            var team = teams.findById(teamId).orElseThrow();
            Team other = new Team();
            other.setName("Outside"); other.setCode("OUT"); other.setTenant(team.getTenant());
            return teams.saveAndFlush(other).getId();
        });
        mvc.perform(get("/api/workspaces/candidates/page").param("size", "1").param("cohortId", cohortId.toString())
                        .param("onlyUncreated", "true").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content.length()").value(1)).andExpect(jsonPath("$.content[0].teamId").value(teamId));
        created("filters");
        mvc.perform(get("/api/workspaces/candidates/page").param("cohortId", cohortId.toString())
                        .param("onlyUncreated", "true").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/workspaces/candidates").param("workspaceStatus", "ACTIVE").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].teamId").value(teamId));
        assertThat(outside).isNotEqualTo(teamId);
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "101", "200000", "bad"})
    void ac02InvalidPageSizeIs422(String size) throws Exception {
        mvc.perform(get("/api/workspaces/candidates/page").param("size", size).header("Authorization", "Bearer " + token))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("size")));
    }

    @Test
    void ac04ReadOnlyCannotCreateAndCreateOnlyConflictDoesNotExposeWorkspaceId() throws Exception {
        long id = created("permissions").get("id").asLong();
        tx.executeWithoutResult(status -> roles.findById(roleId).orElseThrow().getPermissions()
                .removeIf(permission -> permission.getName().equals("CREATE_PROJECT_WORKSPACE")));
        assertThat(create("reader", body()).getResponse().getStatus()).isEqualTo(403);
        tx.executeWithoutResult(status -> {
            var role = roles.findById(roleId).orElseThrow();
            role.setPermissions(new HashSet<>(List.of(permissions.findByName("CREATE_PROJECT_WORKSPACE").orElseThrow())));
        });
        var conflict = create("creator-only", body());
        assertThat(conflict.getResponse().getStatus()).isEqualTo(409);
        assertThat(json.readTree(conflict.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).get("workspaceId").isNull()).isTrue();
        mvc.perform(get("/api/workspaces/{id}", id).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }

    @Test
    void assignedMentorCanCreateWithoutBeingATeamMember() throws Exception {
        tx.executeWithoutResult(status -> {
            members.deleteById(membershipId);
            var team = teams.findById(teamId).orElseThrow();
            team.setMentor(users.findById(actorId).orElseThrow());
            User teammate = new User(); teammate.setEmail(UUID.randomUUID() + "@teammate.test"); teammate.setFirstName("Active"); teammate.setLastName("Member");
            teammate.setTenant(team.getTenant()); teammate.setPasswordHash("unused"); users.saveAndFlush(teammate);
            TeamMember member = new TeamMember(); member.setTeam(team); member.setUser(teammate); members.saveAndFlush(member);
        });
        mvc.perform(get("/api/workspaces/candidates").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].teamId").value(teamId));
        confirm();
        assertThat(created("assigned-mentor").get("teamId").asLong()).isEqualTo(teamId);
    }

    @Test
    void missingKeyAndInvalidIdsAre422AndWriteNothing() throws Exception {
        var before = creationCounts();
        mvc.perform(post("/api/workspaces").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(body())).andExpect(status().isUnprocessableEntity());
        mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"projectId\":0}")).andExpect(status().isUnprocessableEntity());
        assertThat(creationCounts()).isEqualTo(before);
    }
}
