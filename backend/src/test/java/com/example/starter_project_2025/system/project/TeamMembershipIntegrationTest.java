package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
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

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
class TeamMembershipIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TransactionTemplate tx;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired TeamRepository teams;
    @Autowired ProjectRepository projects;
    @Autowired TeamMemberRepository memberships;
    @Autowired WorkspaceRepository workspaces;
    @Autowired WorkspaceActivityRepository activities;
    @Autowired TenantRepository tenants;
    @Autowired UserDetailsService userDetails;
    @Autowired RefreshTokenService tokens;
    Long teamId, projectId, studentId, adminId, workspaceId;
    String teacherToken, adminToken, studentToken;

    String token(String email) {
        return tx.execute(status -> {
            var principal = userDetails.loadUserByUsername(email);
            return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        });
    }

    @BeforeEach void fixture() throws Exception {
        tx.executeWithoutResult(status -> {
            var admin = users.findByEmail("admin@example.com").orElseThrow(); adminId = admin.getId();
            var student = users.findByEmail("student@example.com").orElseThrow(); studentId = student.getId();
            var teacher = users.findByEmail("teacher@example.com").orElseThrow();
            Project project = new Project(); project.setCode(UUID.randomUUID().toString()); project.setName("Membership test");
            project.setStatus(ProjectStatus.ACTIVE); project.setTenant(admin.getTenant()); projects.saveAndFlush(project); projectId = project.getId();
            Team team = new Team(); team.setCode(UUID.randomUUID().toString()); team.setName("Membership test");
            team.setTenant(admin.getTenant()); team.setProject(project); team.setMentor(teacher); teams.saveAndFlush(team); teamId = team.getId();
            TeamMember membership = new TeamMember(); membership.setTeam(team); membership.setUser(student); memberships.saveAndFlush(membership);
        });
        teacherToken = token("teacher@example.com"); adminToken = token("admin@example.com"); studentToken = token("student@example.com");
        var result = mvc.perform(post("/api/workspaces").header("Authorization", "Bearer " + teacherToken)
                .header("X-Idempotency-Key", UUID.randomUUID().toString()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("projectId", projectId, "teamId", teamId))))
                .andExpect(status().isCreated()).andReturn();
        workspaceId = json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }

    void update(String token, Long userId, String role, String participation) throws Exception {
        mvc.perform(put("/api/project-hub/teams/{team}/members/{user}", teamId, userId)
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("projectRole", role, "status", participation))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.projectRole").value(role))
                .andExpect(jsonPath("$.status").value(participation));
    }

    @Test void assignedTeacherAndAdminCanAssignProjectRoles() throws Exception {
        update(teacherToken, studentId, "FE_DEV", "ACTIVE");
        mvc.perform(get("/api/workspaces/{id}/members", workspaceId).header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].project_role").value("FE_DEV"))
                .andExpect(jsonPath("$[0].email").doesNotExist()).andExpect(jsonPath("$[0].userId").doesNotExist());
        update(adminToken, studentId, "UNASSIGNED", "ACTIVE");
    }

    @Test void studentCannotReadManagementOptionsOrModifyOwnRole() throws Exception {
        for (String path : List.of("/api/project-hub/teams/" + teamId + "/members", "/api/project-hub/teams/" + teamId + "/member-options"))
            mvc.perform(get(path).header("Authorization", "Bearer " + studentToken)).andExpect(status().isForbidden());
        mvc.perform(put("/api/project-hub/teams/{team}/members/{user}", teamId, studentId)
                .header("Authorization", "Bearer " + studentToken).contentType(MediaType.APPLICATION_JSON)
                .content("{\"projectRole\":\"TEAM_LEADER\",\"status\":\"ACTIVE\"}")).andExpect(status().isForbidden());
    }

    @Test void rosterChangesRefreshCountsPreserveHistoryAndReuseMembership() throws Exception {
        long beforeWorkspaces = workspaces.count();
        long beforeActivities = activities.count();
        update(teacherToken, adminId, "DEV", "ACTIVE");
        update(teacherToken, studentId, "QA", "LEFT");
        mvc.perform(get("/api/workspaces/{id}", workspaceId).header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.member_count").value(1));
        mvc.perform(get("/api/workspaces/{id}", workspaceId).header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isForbidden());
        long beforeMemberships = memberships.count();
        update(teacherToken, studentId, "QA", "ACTIVE");
        assertThat(memberships.count()).isEqualTo(beforeMemberships);
        assertThat(workspaces.count()).isEqualTo(beforeWorkspaces);
        assertThat(activities.count()).isEqualTo(beforeActivities);
        mvc.perform(get("/api/workspaces/{id}", workspaceId).header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.member_count").value(2));
    }

    @Test void onlyAssignedScopeCanManageMembers() throws Exception {
        tx.executeWithoutResult(status -> teams.findById(teamId).orElseThrow().setMentor(null));
        mvc.perform(get("/api/project-hub/teams/{id}/members", teamId).header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/project-hub/teams/{id}/members/{user}", teamId, studentId)
                .header("Authorization", "Bearer " + teacherToken).contentType(MediaType.APPLICATION_JSON)
                .content("{\"projectRole\":\"QA\",\"status\":\"ACTIVE\"}")).andExpect(status().isForbidden());
    }

    @Test void otherTenantUserIsRejectedWithoutChangingRoster() throws Exception {
        Long foreignId = tx.execute(status -> {
            var tenant = tenants.saveAndFlush(Tenant.builder().code(UUID.randomUUID().toString()).name("Other").build());
            var user = new com.example.starter_project_2025.system.rbac.user.User();
            user.setEmail(UUID.randomUUID() + "@test.invalid"); user.setFirstName("Foreign"); user.setLastName("User");
            user.setPasswordHash("unused"); user.setTenant(tenant);
            return users.saveAndFlush(user).getId();
        });
        mvc.perform(put("/api/project-hub/teams/{id}/members/{user}", teamId, foreignId)
                .header("Authorization", "Bearer " + teacherToken).contentType(MediaType.APPLICATION_JSON)
                .content("{\"projectRole\":\"QA\",\"status\":\"ACTIVE\"}")).andExpect(status().isUnprocessableEntity());
        assertThat(memberships.findByTeamIdAndUserId(teamId, foreignId)).isEmpty();
    }

    @Test void invalidAndMissingRolesAre422() throws Exception {
        for (String body : List.of("{\"status\":\"ACTIVE\"}", "{\"projectRole\":\"ADMIN\",\"status\":\"ACTIVE\"}"))
            mvc.perform(put("/api/project-hub/teams/{id}/members/{user}", teamId, studentId)
                    .header("Authorization", "Bearer " + teacherToken).contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isUnprocessableEntity());
    }
}
