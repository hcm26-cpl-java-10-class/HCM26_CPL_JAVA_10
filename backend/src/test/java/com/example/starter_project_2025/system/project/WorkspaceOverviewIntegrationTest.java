package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.domain.ProjectTopicSnapshot;
import com.example.starter_project_2025.system.project.cohort.Cohort;
import com.example.starter_project_2025.system.project.cohort.CohortRepository;
import com.example.starter_project_2025.system.project.cohort.CohortStatus;
import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassRepository;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassStatus;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.project.workspace.repository.ProjectTopicSnapshotRepository;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;

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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WorkspaceOverviewIntegrationTest {
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
    @Autowired CohortRepository cohorts;
    @Autowired ClassMemberRepository classMembers;
    @Autowired TeamAllocationSessionRepository allocationSessions;
    @Autowired ProjectTopicSnapshotRepository snapshots;
    @Autowired WorkspaceRepository workspaces;
    @Autowired UserDetailsService userDetails;
    @Autowired RefreshTokenService tokens;
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
            role.setPermissions(new HashSet<>(List.of(
                    permissions.findByName("WORKSPACE_READ").orElseThrow(),
                    permissions.findByName("WORKSPACE_CREATE").orElseThrow(),
                    permissions.findByName("WORKSPACE_MEMBER_READ").orElseThrow(),
                    permissions.findByName("WORKSPACE_ACTIVITY_READ").orElseThrow())));
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
            var trainingClass = new TrainingClass();
            trainingClass.setCode("CLASS-" + UUID.randomUUID()); trainingClass.setName("Workspace test class");
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
            team.setTeamName("Team A"); team.setTrainingClass(trainingClass);
            team.setAllocationSession(session); team.setMaxMembers(5);
            team.setStatus(ProjectTeamStatus.ACTIVE);
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

    JsonNode overview() throws Exception {
        return json.readTree(mvc.perform(get("/api/workspaces/{id}", workspaceId)
                .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
    JsonNode members() throws Exception {
        return json.readTree(mvc.perform(get("/api/workspaces/{id}/members", workspaceId)
                .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
    void snapshot(String requirements) {
        tx.executeWithoutResult(status -> snapshots.saveAndFlush(ProjectTopicSnapshot.builder()
                .project(projects.findById(projectId).orElseThrow())
                .topicCode("TOPIC-001").topicTitle("Fixed topic title").version("v1.0.0")
                .description("Frozen description").objectives("Frozen objectives")
                .requirementsJson(requirements)
                .attachmentsJson("[{\"name\":\"Brief\",\"url\":\"https://example.com/brief.pdf\"}]")
                .build()));
    }

    @Test void ac01OverviewMatchesWorkspaceAndHasNoEmbeddedRoster() throws Exception {
        var result = overview();
        assertThat(result.get("id").asLong()).isEqualTo(workspaceId);
        assertThat(result.get("projectId").asLong()).isEqualTo(projectId);
        assertThat(result.get("teamId").asLong()).isEqualTo(teamId);
        assertThat(result.get("projectName").asText()).isEqualTo("Project A");
        assertThat(result.has("members")).isFalse();
    }

    @Test void ac02ProjectBriefUsesFieldsFromProject() throws Exception {
        snapshot("[\"Requirement A\"]");
        tx.executeWithoutResult(status -> {
            var project = projects.findById(projectId).orElseThrow();
            project.setDescription("New content from a later source version");
            var projectClass = new TrainingClass();
            projectClass.setCode("PROJECT-CLASS-" + UUID.randomUUID());
            projectClass.setName("Project class");
            projectClass.setTenantId(tenantId); projectClass.setProgramId(1L);
            projectClass.setStatus(TrainingClassStatus.ONGOING);
            project.setClassId(classes.saveAndFlush(projectClass).getId());
            var cohort = new Cohort();
            cohort.setCode("PROJECT-COHORT-" + UUID.randomUUID());
            cohort.setName("Project cohort");
            cohort.setTenant(tenants.findById(tenantId).orElseThrow());
            cohort.setStatus(CohortStatus.ACTIVE);
            project.setCohort(cohorts.saveAndFlush(cohort));
            teams.findById(teamId).orElseThrow().getTrainingClass().setCohortName("Team cohort");
        });
        var result = overview();
        assertThat(result.get("projectDescription").asText()).isEqualTo("New content from a later source version");
        assertThat(result.get("projectCode").asText()).startsWith("PROJECT-");
        assertThat(result.get("projectName").asText()).isEqualTo("Project A");
        assertThat(result.get("projectStatus").asText()).isEqualTo("ACTIVE");
        assertThat(result.get("projectClassName").asText()).isEqualTo("Project class");
        assertThat(result.get("projectCohortName").asText()).isEqualTo("Project cohort");
        assertThat(result.at("/topic_snapshot/version").asText()).isEqualTo("v1.0.0");
        assertThat(result.at("/topic_snapshot/topic_title").asText()).isEqualTo("Fixed topic title");
        assertThat(result.at("/topic_snapshot/objectives").asText()).isEqualTo("Frozen objectives");
        assertThat(result.at("/topic_snapshot/requirements/0").asText()).isEqualTo("Requirement A");
    }

    @Test void ac03MemberResponseIncludesAllocationRoles() throws Exception {
        tx.executeWithoutResult(status -> memberships.findById(membershipId).orElseThrow()
                .setRole("PM,BA"));
        var result = members();
        assertThat(result).hasSize(1);
        var fields = new HashSet<String>();
        result.get(0).fieldNames().forEachRemaining(fields::add);
        assertThat(fields).containsExactlyInAnyOrder("user_code", "display_name", "roles");
        assertThat(result.at("/0/user_code").asText()).startsWith("MEM-");
        assertThat(result.at("/0/display_name").asText()).isEqualTo("Workspace Reader");
        assertThat(result.at("/0/roles/0").asText()).isEqualTo("PM");
        assertThat(result.at("/0/roles/1").asText()).isEqualTo("BA");
    }

    @Test void ac03ForeignTenantMembershipIsExcluded() throws Exception {
        tx.executeWithoutResult(status -> {
            var foreign = tenants.saveAndFlush(Tenant.builder().code("OTHER-" + UUID.randomUUID()).name("Other").build());
            var user = new User();
            user.setEmail(UUID.randomUUID() + "@foreign.test"); user.setFirstName("Foreign");
            user.setPasswordHash("unused"); user.setTenant(foreign);
            users.saveAndFlush(user);
            var classMember = new ClassMember();
            classMember.setTrainingClass(teams.findById(teamId).orElseThrow().getTrainingClass());
            classMember.setUser(user); classMember.setStatus(ClassMemberStatus.ACTIVE);
            classMembers.saveAndFlush(classMember);
            var membership = new ProjectMember();
            membership.setClassMember(classMember); membership.setTeam(teams.findById(teamId).orElseThrow());
            memberships.saveAndFlush(membership);
        });
        assertThat(members()).hasSize(1);
        assertThat(overview().get("member_count").asInt()).isEqualTo(1);
    }

    @Test void ac04SystemRolesDoNotChangeWorkspaceMemberFields() throws Exception {
        tx.executeWithoutResult(status -> users.findById(actorId).orElseThrow().getRoles()
                .add(roles.findByName("TEACHER").orElseThrow()));
        assertThat(members().get(0).size()).isEqualTo(3);
    }

    @Test void ac05RosterRefreshExcludesInactiveAssignmentAndRetainsHistory() throws Exception {
        long activityCount = jdbc.queryForObject("SELECT COUNT(*) FROM workspace_activities", Long.class);
        tx.executeWithoutResult(status -> memberships.findById(membershipId).orElseThrow()
                .setIsActive(false));
        assertThat(members()).isEmpty();
        var result = overview();
        assertThat(result.get("member_count").asInt()).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspace_activities", Long.class))
                .isEqualTo(activityCount);
    }

    @Test void ac06OverviewOnlyRoleSeesCountButMembersApiIs403() throws Exception {
        tx.executeWithoutResult(status -> roles.findById(roleId).orElseThrow().getPermissions()
                .removeIf(permission -> permission.getName().equals("WORKSPACE_MEMBER_READ")));
        var result = overview();
        assertThat(result.get("member_count").asInt()).isEqualTo(1);
        assertThat(result.get("can_view_members").asBoolean()).isFalse();
        assertThat(result.has("members")).isFalse();
        mvc.perform(get("/api/workspaces/{id}/members", workspaceId)
                .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }

    @Test void ac07OptionalContentAndEmptyRosterAreNotErrors() throws Exception {
        tx.executeWithoutResult(status -> {
            projects.findById(projectId).orElseThrow().setDescription(null);
            memberships.findById(membershipId).orElseThrow()
                    .getClassMember().setStatus(ClassMemberStatus.INACTIVE);
        });
        var result = overview();
        assertThat(result.get("projectDescription").isNull()).isTrue();
        assertThat(result.get("projectClassName").isNull()).isTrue();
        assertThat(result.get("projectCohortName").isNull()).isTrue();
        assertThat(result.get("topic_snapshot").isNull()).isTrue();
        assertThat(result.get("member_count").asInt()).isZero();
        assertThat(members()).isEmpty();
    }

    @Test void projectClassMustBelongToProjectTenant() throws Exception {
        tx.executeWithoutResult(status -> {
            var foreign = tenants.saveAndFlush(Tenant.builder()
                    .code("FOREIGN-" + UUID.randomUUID()).name("Foreign tenant").build());
            var foreignClass = new TrainingClass();
            foreignClass.setCode("FOREIGN-CLASS-" + UUID.randomUUID());
            foreignClass.setName("Foreign class");
            foreignClass.setTenantId(foreign.getId()); foreignClass.setProgramId(1L);
            foreignClass.setStatus(TrainingClassStatus.ONGOING);
            projects.findById(projectId).orElseThrow().setClassId(classes.saveAndFlush(foreignClass).getId());
        });
        assertThat(overview().get("projectClassName").isNull()).isTrue();
    }

    @Test void teamOnlyWorkspaceHasNoProjectBriefFields() throws Exception {
        tx.executeWithoutResult(status -> {
            workspaces.findById(workspaceId).orElseThrow().setProject(null);
            teams.findById(teamId).orElseThrow().setProject(null);
        });
        var result = overview();
        for (String field : List.of("projectId", "projectCode", "projectName", "projectDescription",
                "projectStatus", "projectClassName", "projectCohortName")) {
            assertThat(result.get(field).isNull()).as(field).isTrue();
        }
    }

    @Test void ac08NeitherResponseContainsRestrictedFields() throws Exception {
        for (var result : List.of(overview(), members())) {
            for (String field : List.of("password", "passwordHash", "token", "accessToken",
                    "email", "phone", "draftScores", "unreleasedFeedback")) {
                assertThat(result.findValues(field)).as(field).isEmpty();
            }
        }
    }

    @Test void ac09MissingAuthenticationIs401AndUnknownWorkspaceIs404() throws Exception {
        mvc.perform(get("/api/workspaces/{id}", workspaceId)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/workspaces/{id}/members", workspaceId)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/workspaces/{id}", Long.MAX_VALUE)
                .header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
    }

    @Test void ac09InactiveTenantIs403() throws Exception {
        tx.executeWithoutResult(status -> tenants.findById(tenantId).orElseThrow().setActive(false));
        mvc.perform(get("/api/workspaces/{id}", workspaceId)
                .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }

    @Test void ac09InactiveMemberWithoutMentorAssignmentLosesScope() throws Exception {
        tx.executeWithoutResult(status -> {
            memberships.findById(membershipId).orElseThrow().setIsActive(false);
            teams.findById(teamId).orElseThrow().setAssignedMentorId(null);
        });
        mvc.perform(get("/api/workspaces/{id}", workspaceId)
                .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        mvc.perform(get("/api/workspaces/{id}/members", workspaceId)
                .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }

    @Test void ac10MalformedStoredSnapshotIsAnErrorRatherThanEmptyData() throws Exception {
        snapshot("not-json");
        mvc.perform(get("/api/workspaces/{id}", workspaceId)
                .header("Authorization", "Bearer " + token)).andExpect(status().isInternalServerError());
    }

    @Test void ac10ReadsDoNotWriteOrActivateTheProject() throws Exception {
        tx.executeWithoutResult(status -> projects.findById(projectId).orElseThrow().setStatus(ProjectStatus.PLANNING));
        var tables = List.of("projects", "project_teams", "project_members", "workspaces", "workspace_sections",
                "workspace_activities", "workspace_audits", "workspace_outbox_events",
                "workspace_creation_requests", "project_topic_snapshots");
        var before = new LinkedHashMap<String, Long>();
        for (String table : tables) before.put(table, jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Long.class));
        overview(); members(); overview(); members();
        for (String table : tables) assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Long.class))
                .as(table).isEqualTo(before.get(table));
        tx.executeWithoutResult(status -> {
            assertThat(projects.findById(projectId).orElseThrow().getStatus()).isEqualTo(ProjectStatus.PLANNING);
            assertThat(memberships.findById(membershipId).orElseThrow().getIsActive()).isTrue();
        });
    }
}
