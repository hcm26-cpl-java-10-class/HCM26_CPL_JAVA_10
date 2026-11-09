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
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.workspace.sections.mock-controls.enabled=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WorkspaceSectionsIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TransactionTemplate tx;
    @Autowired JdbcTemplate jdbc;
    @Autowired TenantRepository tenants;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired PermissionRepository permissions;
    @Autowired ProjectRepository projects;
    @Autowired TeamRepository teams;
    @Autowired TeamMemberRepository memberships;
    @Autowired ProjectTopicSnapshotRepository snapshots;
    @Autowired UserDetailsService userDetails;
    @Autowired RefreshTokenService tokens;
    @Autowired MockWorkspaceSectionDataSource mock;
    @Autowired WorkspaceRepository workspaces;
    Long tenantId, actorId, roleId, projectId, teamId, membershipId, workspaceId;
    String token;

    @BeforeEach
    void fixture() throws Exception {
        tx.executeWithoutResult(status -> {
            var tenant = tenants.saveAndFlush(Tenant.builder()
                    .code("US02-" + UUID.randomUUID()).name("US02 test tenant").build());
            tenantId = tenant.getId();
            var role = new Role();
            role.setName("US02-" + UUID.randomUUID());
            role.setPermissions(new HashSet<>(permissions.findAll()));
            roleId = roles.saveAndFlush(role).getId();
            var user = new User();
            user.setEmail(UUID.randomUUID() + "@us02.test");
            user.setFirstName("Workspace"); user.setLastName("Reader");
            user.setUserCode("MEM-" + UUID.randomUUID());
            user.setPasswordHash("unused-test-password");
            user.setTenant(tenant); user.setRoles(new HashSet<>(Set.of(role)));
            actorId = users.saveAndFlush(user).getId();
            var project = new Project();
            project.setCode("PROJECT-" + UUID.randomUUID()); project.setName("Project A");
            project.setDescription("Live project description");
            project.setTenant(tenant); project.setStatus(ProjectStatus.PLANNING);
            projectId = projects.saveAndFlush(project).getId();
            var team = new Team();
            team.setCode("TEAM-" + UUID.randomUUID()); team.setName("Team A");
            team.setTenant(tenant); team.setProject(project); team.setMentor(user);
            teamId = teams.saveAndFlush(team).getId();
            var membership = new TeamMember();
            membership.setTeam(team); membership.setUser(user);
            membershipId = memberships.saveAndFlush(membership).getId();
            var principal = userDetails.loadUserByUsername(user.getEmail());
            token = tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(
                    principal, null, principal.getAuthorities()));
        });
        var created = mvc.perform(post("/api/workspaces")
                .header("Authorization", "Bearer " + token)
                .header("X-Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("projectId", projectId, "teamId", teamId))))
                .andExpect(status().isCreated()).andReturn();
        workspaceId = json.readTree(created.getResponse().getContentAsString()).get("id").asLong();
    }


    WorkspaceSectionDtos.Scope scope() {
        return new WorkspaceSectionDtos.Scope(tenantId, workspaceId, projectId, teamId);
    }
    JsonNode read(String path) throws Exception {
        return json.readTree(mvc.perform(get("/api/workspaces/" + workspaceId + path)
                .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
    void grant(String... names) {
        tx.executeWithoutResult(status -> roles.findById(roleId).orElseThrow().setPermissions(
                new HashSet<>(Arrays.stream(names).map(name -> permissions.findByName(name).orElseThrow()).toList())));
    }
    void student() {
        grant("WORKSPACE_READ", "WORKSPACE_MEMBER_READ", "MILESTONE_READ", "SPRINT_READ", "TASK_WRITE",
                "ARTIFACT_READ", "ARTIFACT_SUBMIT", "FEEDBACK_READ", "WORKSPACE_ACTIVITY_READ");
    }
    void teacher() {
        grant("WORKSPACE_READ", "WORKSPACE_MEMBER_READ", "MILESTONE_READ", "MILESTONE_WRITE",
                "SPRINT_READ", "SPRINT_WRITE", "ARTIFACT_READ", "ARTIFACT_WRITE",
                "ARTIFACT_REVIEW", "FEEDBACK_READ", "FEEDBACK_WRITE", "WORKSPACE_ACTIVITY_READ");
    }
    void postItem(String path, int expected) throws Exception {
        mvc.perform(post("/api/workspaces/" + workspaceId + path)
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"New item\",\"description\":\"Explicit action\",\"published\":true}"))
                .andExpect(status().is(expected));
    }
    void review(String kind, String targetId, int expected) throws Exception {
        mvc.perform(post("/api/workspaces/" + workspaceId + "/reviews")
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("kind", kind, "targetId", targetId,
                        "comment", "Review comments", "score", 9, "published", false))))
                .andExpect(status().is(expected));
    }

    @Test void ac01And02AllDirectSectionApisUseWorkspaceContext() throws Exception {
        mock.seed(scope());
        var navigation = read("/sections");
        assertThat(navigation.get("sections")).hasSize(8);
        for (String key : List.of("milestones", "sprints", "backlog", "artifacts", "feedback", "activity")) {
            var body = read("/" + key);
            assertThat(body.get("workspaceId").asLong()).isEqualTo(workspaceId);
            assertThat(body.get("projectId").asLong()).isEqualTo(projectId);
            assertThat(body.get("teamId").asLong()).isEqualTo(teamId);
            assertThat(body.get("section").asText()).isEqualTo(key);
            assertThat(body.get("items").isArray()).isTrue();
        }
    }
    @Test void ac03UnseededSectionsAreValidEmptyArrays() throws Exception {
        for (String key : List.of("milestones", "sprints", "backlog", "artifacts", "feedback"))
            assertThat(read("/" + key).get("items")).isEmpty();
        assertThat(mock.size(scope())).isZero();
    }
    @Test void ac04SectionDenialPrecedesMockAndAggregateContainsNoActivity() throws Exception {
        mock.seed(scope());
        mock.configure(scope(), WorkspaceSection.MILESTONE,
                new WorkspaceSectionDtos.MockControl(WorkspaceSectionDtos.MockMode.ERROR, 0));
        grant("WORKSPACE_READ");
        assertThat(read("").get("activities").isNull()).isTrue();
        var sections = read("/sections").get("sections");
        assertThat(sections.get(2).get("canRead").asBoolean()).isFalse();
        assertThat(sections.get(7).get("canRead").asBoolean()).isFalse();
        for (String key : List.of("members", "milestones", "sprints", "backlog", "artifacts", "feedback", "activity"))
            mvc.perform(get("/api/workspaces/" + workspaceId + "/" + key)
                    .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }
    @Test void ac04StudentsNeverReceiveDraftMilestonesOrDraftScores() throws Exception {
        mock.seed(scope()); student();
        for (String key : List.of("milestones", "feedback")) {
            var items = read("/" + key).get("items");
            assertThat(items).hasSize(1);
            assertThat(items.get(0).get("published").asBoolean()).isTrue();
        }
        assertThat(read("/feedback").at("/items/0/score").asDouble()).isEqualTo(8.0);
        assertThat(read("").get("activities").isNull()).isTrue();
    }
    @Test void ac05StudentCanWriteTasksAndSubmitButCannotCreateOrReviewStaffItems() throws Exception {
        mock.seed(scope()); student();
        for (String key : List.of("/milestones", "/sprints", "/artifacts", "/feedback")) postItem(key, 403);
        postItem("/tasks", 201);
        postItem("/artifacts/submit", 201);
        review("ARTIFACT", "artifacts-" + workspaceId + "-published", 403);
        review("MILESTONE", "milestones-" + workspaceId + "-published", 403);
        review("SPRINT", "sprints-" + workspaceId + "-published", 403);
        String taskId = read("/backlog").at("/items/0/id").asText();
        mvc.perform(put("/api/workspaces/" + workspaceId + "/tasks/" + taskId)
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Updated task\",\"published\":true}")).andExpect(status().isOk());
        assertThat(read("/backlog").at("/items/0/title").asText()).isEqualTo("Updated task");
    }
    @Test void ac05TeacherWritesAndBothReviewTypesWorkButSubmissionRequiresSeparatePermission() throws Exception {
        mock.seed(scope()); teacher();
        for (String key : List.of("/milestones", "/sprints", "/tasks", "/artifacts", "/feedback")) postItem(key, 201);
        postItem("/artifacts/submit", 403);
        review("ARTIFACT", "artifacts-" + workspaceId + "-published", 201);
        review("MILESTONE", "milestones-" + workspaceId + "-published", 201);
        review("SPRINT", "sprints-" + workspaceId + "-published", 201);
        // Either ARTIFACT_REVIEW or FEEDBACK_WRITE is sufficient, still requiring ARTIFACT_READ.
        grant("WORKSPACE_READ", "ARTIFACT_READ", "FEEDBACK_WRITE");
        review("ARTIFACT", "artifacts-" + workspaceId + "-published", 201);
        grant("WORKSPACE_READ", "ARTIFACT_READ", "ARTIFACT_REVIEW");
        review("ARTIFACT", "artifacts-" + workspaceId + "-published", 201);
    }
    @Test void ac05ReadOnlyUsersCannotInvokeAnyWriteEndpoint() throws Exception {
        grant("WORKSPACE_READ", "MILESTONE_READ", "SPRINT_READ", "ARTIFACT_READ", "FEEDBACK_READ");
        for (String key : List.of("/milestones", "/sprints", "/tasks", "/artifacts", "/artifacts/submit", "/feedback"))
            postItem(key, 403);
        review("ARTIFACT", "any", 403);
        mvc.perform(put("/api/workspaces/" + workspaceId + "/tasks/any")
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Forbidden edit\"}")).andExpect(status().isForbidden());
    }
    @Test void ac06ForeignWorkspaceTargetsCannotBeReadOrReviewedThroughCurrentContext() throws Exception {
        mock.seed(scope());
        var foreignScope = new WorkspaceSectionDtos.Scope(tenantId, workspaceId + 100000, projectId + 100000, teamId + 100000);
        mock.seed(foreignScope);
        review("ARTIFACT", "artifacts-" + foreignScope.workspaceId() + "-published", 404);
        assertThat(read("/artifacts").get("items").toString()).doesNotContain("workspace " + foreignScope.workspaceId());
        mvc.perform(put("/api/workspaces/" + workspaceId + "/tasks/backlog-" + foreignScope.workspaceId() + "-published")
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Cross context edit\"}")).andExpect(status().isNotFound());
    }
    @Test void ac07ErrorAndEmptyControlsStayInsideOneSection() throws Exception {
        mock.seed(scope());
        for (var mode : List.of(WorkspaceSectionDtos.MockMode.ERROR, WorkspaceSectionDtos.MockMode.NOT_FOUND)) {
            mock.configure(scope(), WorkspaceSection.MILESTONE, new WorkspaceSectionDtos.MockControl(mode, 0));
            mvc.perform(get("/api/workspaces/" + workspaceId + "/milestones")
                    .header("Authorization", "Bearer " + token))
                    .andExpect(status().is(mode == WorkspaceSectionDtos.MockMode.ERROR ? 500 : 404))
                    .andExpect(jsonPath("$.correlationId").isNotEmpty());
            assertThat(read("/sprints").get("items")).hasSize(2);
            assertThat(read("").get("id").asLong()).isEqualTo(workspaceId);
        }
        mock.configure(scope(), WorkspaceSection.MILESTONE,
                new WorkspaceSectionDtos.MockControl(WorkspaceSectionDtos.MockMode.EMPTY, 0));
        assertThat(read("/milestones").get("items")).isEmpty();
    }
    @Test void ac08SameTokenReflectsPermissionAndAssignmentRevocation() throws Exception {
        mock.seed(scope());
        read("/feedback");
        tx.executeWithoutResult(status -> roles.findById(roleId).orElseThrow().getPermissions()
                .removeIf(permission -> permission.getName().equals("FEEDBACK_READ")));
        mvc.perform(get("/api/workspaces/" + workspaceId + "/feedback")
                .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        assertThat(read("/sections").get("sections").get(6).get("canRead").asBoolean()).isFalse();
        tx.executeWithoutResult(status -> {
            teams.findById(teamId).orElseThrow().setMentor(null);
            memberships.findById(membershipId).orElseThrow().setParticipationStatus(ParticipationStatus.LEFT);
        });
        mvc.perform(get("/api/workspaces/" + workspaceId + "/sprints")
                .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        mvc.perform(get("/api/workspaces/" + workspaceId + "/sections")
                .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }
    @Test void ac02AuthenticationTenantAndNotFoundAreRechecked() throws Exception {
        mvc.perform(get("/api/workspaces/" + workspaceId + "/milestones")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/workspaces/" + workspaceId + "/milestones")
                .header("Authorization", "Bearer invalid-token")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/workspaces/9223372036854775806/milestones")
                .header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
        tx.executeWithoutResult(status -> tenants.findById(tenantId).orElseThrow().setActive(false));
        mvc.perform(get("/api/workspaces/" + workspaceId + "/milestones")
                .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }
    @Test void ac09NavigationDoesNotCreateOrChangeBusinessData() throws Exception {
        mock.seed(scope());
        long rows = mock.size(scope()), workspaceCount = workspaces.count(), memberCount = memberships.count();
        long activityCount = jdbc.queryForObject("select count(*) from workspace_activities", Long.class);
        for (int repeat = 0; repeat < 2; repeat++) {
            read("/sections"); read(""); read("/members");
            for (String key : List.of("milestones", "sprints", "backlog", "artifacts", "feedback", "activity")) read("/" + key);
        }
        assertThat(mock.size(scope())).isEqualTo(rows);
        assertThat(workspaces.count()).isEqualTo(workspaceCount);
        assertThat(memberships.count()).isEqualTo(memberCount);
        assertThat(jdbc.queryForObject("select count(*) from workspace_activities", Long.class)).isEqualTo(activityCount);
        assertThat(projects.findById(projectId).orElseThrow().getStatus()).isEqualTo(ProjectStatus.ACTIVE);
    }
    @Test void localMockControlsRequireAdminAndDoNotGrantSectionAccess() throws Exception {
        mvc.perform(put("/api/workspaces/" + workspaceId + "/mock-sections/milestones")
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"mode\":\"DATA\",\"delayMs\":0}")).andExpect(status().isForbidden());
        tx.executeWithoutResult(status -> users.findById(actorId).orElseThrow().getRoles()
                .add(roles.findByName("ADMIN").orElseThrow()));
        mvc.perform(put("/api/workspaces/" + workspaceId + "/mock-sections/milestones")
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"mode\":\"DATA\",\"delayMs\":0}")).andExpect(status().isOk());
        assertThat(read("/milestones").get("items")).hasSize(2);
    }
}
