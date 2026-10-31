package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.trainingclass.*;
import com.example.starter_project_2025.system.project.sprint.*;
import com.example.starter_project_2025.system.project.sprint_backlog.*;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceSection;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceSectionDtos;
import com.example.starter_project_2025.system.project.workspace.repository.ProjectTopicSnapshotRepository;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import com.example.starter_project_2025.system.project.workspace.service.MockWorkspaceSectionDataSource;

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
    @Autowired ProjectTeamRepository teams;
    @Autowired ProjectMemberRepository memberships;
    @Autowired TrainingClassRepository classes;
    @Autowired ClassMemberRepository classMembers;
    @Autowired TeamAllocationSessionRepository allocationSessions;
    @Autowired SprintRepository sprints;
    @Autowired SprintBacklogRepository backlogItems;
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
            project.setTenant(tenant); project.setStatus(ProjectStatus.ACTIVE);
            projectId = projects.saveAndFlush(project).getId();
            var trainingClass = new TrainingClass();
            trainingClass.setCode("US02-" + UUID.randomUUID()); trainingClass.setName("Workspace test class");
            trainingClass.setTenantId(tenantId); trainingClass.setProgramId(1L);
            trainingClass.setStatus(TrainingClassStatus.ONGOING);
            classes.saveAndFlush(trainingClass);
            var session = new TeamAllocationSession();
            session.setTrainingClass(trainingClass); session.setMaxMembers(5);
            session.setStatus(TeamAllocationSessionStatus.PUBLISHED);
            allocationSessions.saveAndFlush(session);
            var classMember = new ClassMember();
            classMember.setTrainingClass(trainingClass); classMember.setUser(user);
            classMember.setStatus(ClassMemberStatus.ACTIVE);
            classMembers.saveAndFlush(classMember);
            var team = new ProjectTeam();
            team.setTeamName("Team A"); team.setTrainingClass(trainingClass); team.setAllocationSession(session);
            team.setMaxMembers(5); team.setStatus(ProjectTeamStatus.ACTIVE);
            team.setProject(project); team.setAssignedMentorId(actorId);
            teamId = teams.saveAndFlush(team).getId();
            var membership = new ProjectMember();
            membership.setTeam(team); membership.setClassMember(classMember);
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
            teams.findById(teamId).orElseThrow().setAssignedMentorId(null);
            memberships.findById(membershipId).orElseThrow().getClassMember().setStatus(ClassMemberStatus.INACTIVE);
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
    @Test void membersReadCurrentAllocationRosterWithMultipleRoles() throws Exception {
        tx.executeWithoutResult(status -> memberships.findById(membershipId).orElseThrow().setRole("PM,BA"));

        JsonNode initial = read("/members");
        assertThat(initial).hasSize(1);
        assertThat(initial.get(0).get("user_code").asText()).startsWith("MEM-");
        assertThat(initial.get(0).get("display_name").asText()).isEqualTo("Workspace Reader");
        assertThat(initial.at("/0/roles/0").asText()).isEqualTo("PM");
        assertThat(initial.at("/0/roles/1").asText()).isEqualTo("BA");
        assertThat(initial.get(0).has("project_role")).isFalse();
        assertThat(initial.get(0).has("status")).isFalse();
        assertThat(read("").get("member_count").asInt()).isEqualTo(1);
        JsonNode navigation = read("/sections");
        assertThat(navigation.get("classId").asLong()).isPositive();
        assertThat(navigation.get("allocationSessionId").asLong()).isPositive();
        assertThat(navigation.get("teamId").asLong()).isEqualTo(teamId);
        for (JsonNode section : navigation.get("sections")) {
            if ("members".equals(section.get("key").asText())) {
                assertThat(section.get("actions").has("manage")).isFalse();
            }
        }

        Long addedId = tx.execute(status -> {
            User actor = users.findById(actorId).orElseThrow();
            var added = new User();
            added.setEmail(UUID.randomUUID() + "@members.test");
            added.setFirstName("Added");
            added.setLastName("Member");
            added.setUserCode("ADD-" + UUID.randomUUID());
            added.setPasswordHash("unused-test-password");
            added.setTenant(actor.getTenant());
            users.saveAndFlush(added);
            var classMember = new ClassMember();
            classMember.setTrainingClass(teams.findById(teamId).orElseThrow().getTrainingClass());
            classMember.setUser(added);
            classMember.setStatus(ClassMemberStatus.ACTIVE);
            classMembers.saveAndFlush(classMember);
            var assignment = new ProjectMember();
            assignment.setTeam(teams.findById(teamId).orElseThrow());
            assignment.setClassMember(classMember);
            return memberships.saveAndFlush(assignment).getId();
        });

        JsonNode withNewMember = read("/members");
        assertThat(withNewMember).hasSize(2);
        assertThat(withNewMember.get(1).get("roles")).isEmpty();
        assertThat(read("").get("member_count").asInt()).isEqualTo(2);
        tx.executeWithoutResult(status -> {
            var foreignTenant = tenants.saveAndFlush(Tenant.builder()
                    .code("FOREIGN-" + UUID.randomUUID()).name("Foreign tenant").build());
            var foreignUser = new User();
            foreignUser.setEmail(UUID.randomUUID() + "@foreign.test");
            foreignUser.setFirstName("Foreign");
            foreignUser.setPasswordHash("unused-test-password");
            foreignUser.setTenant(foreignTenant);
            users.saveAndFlush(foreignUser);
            var foreignClassMember = new ClassMember();
            foreignClassMember.setTrainingClass(teams.findById(teamId).orElseThrow().getTrainingClass());
            foreignClassMember.setUser(foreignUser);
            foreignClassMember.setStatus(ClassMemberStatus.ACTIVE);
            classMembers.saveAndFlush(foreignClassMember);
            var foreignAssignment = new ProjectMember();
            foreignAssignment.setTeam(teams.findById(teamId).orElseThrow());
            foreignAssignment.setClassMember(foreignClassMember);
            memberships.saveAndFlush(foreignAssignment);
        });
        assertThat(read("/members")).hasSize(2);
        assertThat(read("").get("member_count").asInt()).isEqualTo(2);
        tx.executeWithoutResult(status -> memberships.findById(addedId).orElseThrow().setIsActive(false));
        assertThat(read("/members")).hasSize(1);
        assertThat(read("").get("member_count").asInt()).isEqualTo(1);
        tx.executeWithoutResult(status -> memberships.findById(membershipId).orElseThrow()
                .getClassMember().setStatus(ClassMemberStatus.INACTIVE));
        assertThat(read("/members")).isEmpty();
        assertThat(read("").get("member_count").asInt()).isZero();
    }

    @Test void projectHubCannotModifyAllocationMembership() throws Exception {
        mvc.perform(get("/api/project-hub/teams/{id}/members", teamId)
                .header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
        mvc.perform(get("/api/project-hub/teams/{id}/member-options", teamId)
                .header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
        mvc.perform(put("/api/project-hub/teams/{id}/members/{userId}", teamId, actorId)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"projectRole\":\"QA\",\"status\":\"ACTIVE\"}"))
                .andExpect(status().isNotFound());
        assertThat(memberships.findById(membershipId).orElseThrow().getRole()).isNull();
    }

    @Test void roleApiCanRevokeAndRestoreReadPermissionWithTheSameToken() throws Exception {
        var response = mvc.perform(get("/api/roles/" + roleId)
                .header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andReturn();
        var role = json.readTree(response.getResponse().getContentAsString());
        var backup = new ArrayList<Long>();
        role.get("permissionIds").forEach(value -> backup.add(value.asLong()));
        Long removedId = permissions.findByName("MILESTONE_READ").orElseThrow().getId();
        var reduced = backup.stream().filter(id -> !id.equals(removedId)).toList();
        mvc.perform(put("/api/roles/" + roleId).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("permissionIds", reduced)))).andExpect(status().isOk());
        mvc.perform(get("/api/workspaces/" + workspaceId + "/milestones")
                .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        mvc.perform(put("/api/roles/" + roleId).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("permissionIds", backup)))).andExpect(status().isOk());
        read("/milestones");
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

    List<WorkspaceSectionDtos.BoardColumn> workflowColumns() {
        return List.of(new WorkspaceSectionDtos.BoardColumn("BACKLOG", "Backlog", true),
                new WorkspaceSectionDtos.BoardColumn("TODO", "To do", true),
                new WorkspaceSectionDtos.BoardColumn("IN_PROGRESS", "In progress", true),
                new WorkspaceSectionDtos.BoardColumn("REVIEW", "Review", true),
                new WorkspaceSectionDtos.BoardColumn("CUSTOM_1", "Quality assurance", true),
                new WorkspaceSectionDtos.BoardColumn("CUSTOM_2", "Staging", true),
                new WorkspaceSectionDtos.BoardColumn("CUSTOM_3", "Ready for release", true),
                new WorkspaceSectionDtos.BoardColumn("DONE", "Done", true));
    }

    void saveColumns(List<WorkspaceSectionDtos.BoardColumn> columns, int expected) throws Exception {
        mvc.perform(put("/api/workspaces/{id}/board-columns", workspaceId)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("columns", columns))))
                .andExpect(status().is(expected));
    }

    Long workItem() {
        return tx.execute(status -> {
            var sprint = new Sprint();
            sprint.setName("Workflow regression " + UUID.randomUUID());
            sprint.setProjectId(projectId); // Project-backed sprints may not carry teamId.
            sprint.setStatus(SprintStatus.ACTIVE);
            sprint = sprints.saveAndFlush(sprint);
            var item = new SprintBacklog();
            item.setTitle("Open and edit this card"); item.setProjectId(projectId); item.setSprint(sprint);
            return backlogItems.saveAndFlush(item).getId();
        });
    }

    void changeStatus(Long itemId, String next, int expected) throws Exception {
        mvc.perform(put("/api/sprint-backlogs/{id}", itemId)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("status", next))))
                .andExpect(status().is(expected));
    }

    @Test void eightColumnWorkflowPersistsNamesAndRejectsInvalidSettingsWithoutOverwriting() throws Exception {
        var columns = new ArrayList<>(workflowColumns());
        saveColumns(columns, 200);
        assertThat(read("/board-columns").get("columns")).hasSize(8);
        columns.set(4, new WorkspaceSectionDtos.BoardColumn("CUSTOM_1", "QA approved", true));
        saveColumns(columns, 200);
        assertThat(read("/board-columns").at("/columns/4/label").asText()).isEqualTo("QA approved");
        var tooMany = new ArrayList<>(columns);
        tooMany.add(new WorkspaceSectionDtos.BoardColumn("CUSTOM_4", "Ninth column", true));
        saveColumns(tooMany, 422);
        var duplicateName = new ArrayList<>(columns);
        duplicateName.set(4, new WorkspaceSectionDtos.BoardColumn("CUSTOM_1", "Review", true));
        saveColumns(duplicateName, 422);
        saveColumns(columns.stream().filter(column -> !column.key().equals("TODO")).toList(), 422);
        var nullColumn = new ArrayList<>(columns);
        nullColumn.set(4, null);
        saveColumns(nullColumn, 422);
        assertThat(read("/board-columns").get("columns")).hasSize(8);
        assertThat(read("/board-columns").at("/columns/4/label").asText()).isEqualTo("QA approved");
        grant("WORKSPACE_READ", "SPRINT_READ");
        saveColumns(workflowColumns(), 403);
        assertThat(read("/board-columns").at("/columns/4/label").asText()).isEqualTo("QA approved");
    }

    @Test void emptyStandardColumnCanBeDeletedButOccupiedColumnAndAnchorsAreProtected() throws Exception {
        var columns = workflowColumns().stream().filter(c -> !c.key().startsWith("CUSTOM_")).toList();
        saveColumns(columns, 200);
        Long itemId = workItem();
        changeStatus(itemId, "IN_PROGRESS", 200);
        saveColumns(columns.stream().filter(c -> !c.key().equals("IN_PROGRESS")).toList(), 409);
        var withoutReview = columns.stream().filter(c -> !c.key().equals("REVIEW")).toList();
        saveColumns(withoutReview, 200);
        assertThat(read("/board-columns").get("columns")).hasSize(4);
        changeStatus(itemId, "REVIEW", 422);
        changeStatus(itemId, "DONE", 200);
        changeStatus(itemId, "IN_PROGRESS", 200);
        saveColumns(withoutReview.stream().filter(c -> !c.key().equals("DONE")).toList(), 422);
        assertThat(read("/board-columns").get("columns")).hasSize(4);
    }

    @Test void customStatusesEnforceAdjacentTransitionsAndCannotBeRemovedWhileInUse() throws Exception {
        saveColumns(workflowColumns(), 200);
        Long itemId = workItem();
        changeStatus(itemId, "DONE", 422);
        changeStatus(itemId, "IN_PROGRESS", 200);
        changeStatus(itemId, "TODO", 200);
        changeStatus(itemId, "IN_PROGRESS", 200);
        changeStatus(itemId, "REVIEW", 200);
        changeStatus(itemId, "DONE", 422); // Configured custom steps cannot be skipped.
        changeStatus(itemId, "CUSTOM_1", 200);
        saveColumns(workflowColumns().stream().filter(column -> !column.key().equals("CUSTOM_1")).toList(), 409);
        changeStatus(itemId, "CUSTOM_2", 200);
        changeStatus(itemId, "CUSTOM_3", 200);
        changeStatus(itemId, "DONE", 200);
        changeStatus(itemId, "REVIEW", 422);
        changeStatus(itemId, "IN_PROGRESS", 422);
        changeStatus(itemId, "CUSTOM_3", 200);
        mvc.perform(get("/api/sprint-backlogs/{id}", itemId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CUSTOM_3"));
    }

    @Test void standardWorkflowAllowsBackwardStepsButRejectsSkippedSteps() throws Exception {
        Long itemId = workItem();
        changeStatus(itemId, "REVIEW", 422);
        changeStatus(itemId, "IN_PROGRESS", 200);
        changeStatus(itemId, "TODO", 200);
        changeStatus(itemId, "IN_PROGRESS", 200);
        changeStatus(itemId, "REVIEW", 200);
        changeStatus(itemId, "DONE", 200);
        changeStatus(itemId, "IN_PROGRESS", 422);
        changeStatus(itemId, "REVIEW", 200);
        changeStatus(itemId, "IN_PROGRESS", 200);
    }

    @Test void productBacklogOnlyConnectsToTodoAndCannotBypassWorkflowThroughSprintAssignment() throws Exception {
        Long itemId = workItem();
        Long sprintId = tx.execute(status -> backlogItems.findById(itemId).orElseThrow().getSprint().getId());
        changeStatus(itemId, "IN_PROGRESS", 200);
        mvc.perform(put("/api/sprints/{id}/backlog-items", sprintId)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"taskIds\":[]}"))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(get("/api/sprint-backlogs/{id}", itemId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.sprintId").value(sprintId))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
        changeStatus(itemId, "TODO", 200);
        mvc.perform(put("/api/sprints/{id}/backlog-items", sprintId)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"taskIds\":[]}"))
                .andExpect(status().isOk());
        changeStatus(itemId, "IN_PROGRESS", 422);
        mvc.perform(put("/api/sprint-backlogs/{id}", itemId)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("sprintId", sprintId, "status", "IN_PROGRESS"))))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(get("/api/sprint-backlogs/{id}", itemId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.sprintId").isEmpty())
                .andExpect(jsonPath("$.status").value("TODO"));
        mvc.perform(put("/api/sprints/{id}/backlog-items", sprintId)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("taskIds", List.of(itemId)))))
                .andExpect(status().isOk());
        changeStatus(itemId, "IN_PROGRESS", 200);
    }

    @Test void productBacklogWithStaleStatusCanReenterSprintOnlyAsTodo() throws Exception {
        Long itemId = workItem();
        Long sprintId = tx.execute(status -> backlogItems.findById(itemId).orElseThrow().getSprint().getId());

        mvc.perform(put("/api/sprints/{id}/backlog-items", sprintId)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"taskIds\":[]}"))
                .andExpect(status().isOk());
        tx.executeWithoutResult(status -> backlogItems.findById(itemId).orElseThrow()
                .setStatus(SprintBacklogStatus.IN_PROGRESS));

        mvc.perform(put("/api/sprint-backlogs/{id}", itemId)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("sprintId", sprintId, "status", "IN_PROGRESS"))))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(put("/api/sprint-backlogs/{id}", itemId)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("sprintId", sprintId, "status", "TODO"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.sprintId").value(sprintId))
                .andExpect(jsonPath("$.status").value("TODO"));
    }

    @Test void boardAssignmentAndClearingMatchTheDetailRecord() throws Exception {
        Long itemId = workItem();
        mvc.perform(put("/api/teams/{teamId}/backlog-board/items/{id}/assignee", teamId, itemId)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("projectMemberId", membershipId))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assigneeProjectMemberId").value(membershipId));
        mvc.perform(get("/api/sprint-backlogs/{id}", itemId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assigneeProjectMemberId").value(membershipId));
        mvc.perform(get("/api/teams/{teamId}/backlog-board", teamId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].assigneeDisplayName").value("Workspace Reader"));
        mvc.perform(put("/api/teams/{teamId}/backlog-board/items/{id}/assignee", teamId, itemId)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"projectMemberId\":null}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assigneeProjectMemberId").doesNotExist());
        mvc.perform(get("/api/sprint-backlogs/{id}", itemId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assigneeProjectMemberId").doesNotExist());
        mvc.perform(get("/api/teams/{teamId}/backlog-board", teamId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].assigneeProjectMemberId").doesNotExist())
                .andExpect(jsonPath("$.items[0].assigneeDisplayName").doesNotExist());
    }

    Long additionalAssignee() {
        return tx.execute(status -> {
            var team = teams.findById(teamId).orElseThrow();
            var user = new User();
            user.setEmail(UUID.randomUUID() + "@assignee.test");
            user.setUserCode("ASSIGNEE-" + UUID.randomUUID());
            user.setFirstName("Assigned"); user.setLastName("Member");
            user.setPasswordHash("unused-test-password"); user.setTenant(tenants.findById(tenantId).orElseThrow());
            users.saveAndFlush(user);
            var cm = new ClassMember(); cm.setTrainingClass(team.getTrainingClass()); cm.setUser(user);
            cm.setStatus(ClassMemberStatus.ACTIVE); classMembers.saveAndFlush(cm);
            var member = new ProjectMember(); member.setTeam(team); member.setClassMember(cm);
            return memberships.saveAndFlush(member).getId();
        });
    }

    @Test void unavailableAssigneeKeepsTheirNameButCannotReceiveNewAssignments() throws Exception {
        Long assigneeId = additionalAssignee();
        Long itemId = workItem();
        mvc.perform(put("/api/sprint-backlogs/{id}", itemId)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("assigneeProjectMemberId", assigneeId))))
                .andExpect(status().isOk());
        tx.executeWithoutResult(status -> memberships.findById(assigneeId).orElseThrow()
                .getClassMember().setStatus(ClassMemberStatus.INACTIVE));
        var board = mvc.perform(get("/api/teams/{teamId}/backlog-board", teamId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].assigneeProjectMemberId").value(assigneeId))
                .andExpect(jsonPath("$.items[0].assigneeDisplayName").value("Assigned Member"))
                .andReturn();
        assertThat(json.readTree(board.getResponse().getContentAsString()).get("members").findValuesAsText("projectMemberId"))
                .doesNotContain(assigneeId.toString());
        mvc.perform(put("/api/teams/{teamId}/backlog-board/items/{id}/assignee", teamId, itemId)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("projectMemberId", assigneeId))))
                // This controller uses the existing global validation envelope (400).
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("active member")));
        mvc.perform(get("/api/sprint-backlogs/{id}", itemId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assigneeProjectMemberId").value(assigneeId));
        // Historical assignments must not block unrelated title/description edits.
        mvc.perform(put("/api/sprint-backlogs/{id}", itemId)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Keep historical assignment\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assigneeProjectMemberId").value(assigneeId));
    }

    void assertAssigneeOptionsMatchBoard(Long assigneeId, boolean available) throws Exception {
        var options = mvc.perform(get("/api/sprint-backlogs/assignee-options").param("teamId", teamId.toString())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn();
        var board = mvc.perform(get("/api/teams/{teamId}/backlog-board", teamId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn();
        var optionIds = json.readTree(options.getResponse().getContentAsString()).findValuesAsText("id");
        var boardIds = json.readTree(board.getResponse().getContentAsString()).get("members").findValuesAsText("projectMemberId");
        assertThat(optionIds.contains(assigneeId.toString())).isEqualTo(available);
        assertThat(boardIds.contains(assigneeId.toString())).isEqualTo(available);
    }

    @Test void eligibleMembersAreListedByBothPickersAndReturnAfterReactivation() throws Exception {
        Long assigneeId = additionalAssignee();
        Long itemId = workItem();
        assertAssigneeOptionsMatchBoard(assigneeId, true);
        for (String state : List.of("locked", "disabled-user", "inactive-member", "disabled-membership")) {
            tx.executeWithoutResult(status -> {
                var member = memberships.findById(assigneeId).orElseThrow();
                if (state.equals("locked")) member.getClassMember().getUser().setLocked(true);
                if (state.equals("disabled-user")) member.getClassMember().getUser().setIsActive(false);
                if (state.equals("inactive-member")) member.getClassMember().setStatus(ClassMemberStatus.INACTIVE);
                if (state.equals("disabled-membership")) member.setIsActive(false);
            });
            assertAssigneeOptionsMatchBoard(assigneeId, false);
            mvc.perform(put("/api/sprint-backlogs/{id}", itemId)
                            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                            .content(json.writeValueAsString(Map.of("assigneeProjectMemberId", assigneeId))))
                    .andExpect(status().isUnprocessableEntity());
            tx.executeWithoutResult(status -> {
                var member = memberships.findById(assigneeId).orElseThrow();
                member.setIsActive(true); member.getClassMember().setStatus(ClassMemberStatus.ACTIVE);
                member.getClassMember().getUser().setLocked(false); member.getClassMember().getUser().setIsActive(true);
            });
            assertAssigneeOptionsMatchBoard(assigneeId, true);
        }
        mvc.perform(put("/api/sprint-backlogs/{id}", itemId)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("assigneeProjectMemberId", assigneeId))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assigneeProjectMemberId").value(assigneeId));
    }

    @Test void detailAndCreateRejectForeignOrMissingAssigneesWithoutChangingExistingAssignment() throws Exception {
        Long foreignId = tx.execute(status -> {
            var ownTeam = teams.findById(teamId).orElseThrow();
            var team = new ProjectTeam(); team.setTeamName("Other team"); team.setTrainingClass(ownTeam.getTrainingClass());
            team.setAllocationSession(ownTeam.getAllocationSession()); team.setMaxMembers(5); team.setStatus(ProjectTeamStatus.ACTIVE);
            teams.saveAndFlush(team);
            var member = new ProjectMember(); member.setTeam(team);
            member.setClassMember(memberships.findById(membershipId).orElseThrow().getClassMember());
            return memberships.saveAndFlush(member).getId();
        });
        Long itemId = workItem();
        for (Long invalid : List.of(foreignId, Long.MAX_VALUE)) {
            mvc.perform(put("/api/sprint-backlogs/{id}", itemId)
                            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                            .content(json.writeValueAsString(Map.of("assigneeProjectMemberId", invalid))))
                    .andExpect(status().isUnprocessableEntity());
            mvc.perform(post("/api/sprint-backlogs")
                            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                            .content(json.writeValueAsString(Map.of("title", "Invalid assignment", "projectId", projectId,
                                    "isActive", true, "assigneeProjectMemberId", invalid))))
                    .andExpect(status().isUnprocessableEntity());
        }
        mvc.perform(get("/api/sprint-backlogs/{id}", itemId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assigneeProjectMemberId").doesNotExist());
        mvc.perform(post("/api/sprint-backlogs")
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("title", "Valid assignment", "projectId", projectId,
                                "isActive", true, "assigneeProjectMemberId", membershipId))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assigneeProjectMemberId").value(membershipId));
    }

    @Test void cardDetailEditsAndAssigneeAreReflectedOnTheTeamBoard() throws Exception {
        Long itemId = workItem();
        mvc.perform(get("/api/sprint-backlogs/{id}", itemId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Open and edit this card"));
        mvc.perform(put("/api/sprint-backlogs/{id}", itemId)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("title", "Edited from card details",
                                "description", "Persisted description", "assigneeProjectMemberId", membershipId,
                                "priority", "HIGH", "estimatedHours", 5))))
                .andExpect(status().isOk());
        mvc.perform(get("/api/teams/{teamId}/backlog-board", teamId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value("Edited from card details"))
                .andExpect(jsonPath("$.items[0].description").value("Persisted description"))
                .andExpect(jsonPath("$.items[0].assigneeProjectMemberId").value(membershipId))
                .andExpect(jsonPath("$.items[0].assigneeDisplayName").value("Workspace Reader"));
        grant("WORKSPACE_READ", "SPRINT_READ", "SPRINT_BACKLOG_READ");
        mvc.perform(get("/api/sprint-backlogs/{id}", itemId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        mvc.perform(put("/api/sprint-backlogs/{id}", itemId)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Forbidden edit\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/sprint-backlogs/{id}", itemId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Edited from card details"));
    }
}
