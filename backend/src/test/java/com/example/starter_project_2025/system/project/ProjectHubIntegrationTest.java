package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.dto.ProjectHubDtos;
import com.example.starter_project_2025.system.project.trainingclass.*;
import jakarta.persistence.EntityManager;
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
        "milestone.mock.tenant-time-zone=Asia/Tokyo",
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
    @Autowired ProjectTeamRepository teams;
    @Autowired ProjectMemberRepository members;
    @Autowired EntityManager entityManager;
    @Autowired com.example.starter_project_2025.system.project.charter.TeamCharterRevisionRepository charterRevisions;
    @Autowired com.example.starter_project_2025.system.project.charter.TeamCharterService charterService;
    @Autowired ProjectTeamAuditRepository charterAudits;
    @Autowired ProjectTeamOutboxRepository charterOutbox;
    @Autowired com.example.starter_project_2025.system.project.charter.TeamCharterConfirmationRepository charterConfirmations;
    @Autowired ProjectTeamRoleService roleService;
    @Autowired ProjectTeamMembershipService membershipService;
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
    private ProjectTeam team;
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
            team = createTeam(admin.getTenant(), project, "Integration team");
            ClassMember classMember = new ClassMember();
            classMember.setTrainingClass(team.getTrainingClass());
            classMember.setUser(student);
            classMember.setStatus(ClassMemberStatus.ACTIVE);
            entityManager.persist(classMember);
            ProjectMember membership = new ProjectMember();
            membership.setTeam(team);
            membership.setClassMember(classMember);
            membership.setRole("DEV");
            members.saveAndFlush(membership);
            adminToken = token("admin@example.com");
            studentToken = token("student@example.com");
        });
    }

    private ProjectTeam createTeam(Tenant tenant, Project project, String name) {
        TrainingClass trainingClass = new TrainingClass();
        trainingClass.setCode("TEST-" + UUID.randomUUID());
        trainingClass.setName("Project Hub test class");
        trainingClass.setTenantId(tenant.getId());
        trainingClass.setProgramId(1L);
        trainingClass.setStatus(TrainingClassStatus.ONGOING);
        entityManager.persist(trainingClass);
        TeamAllocationSession session = new TeamAllocationSession();
        session.setTrainingClass(trainingClass);
        session.setMaxMembers(7);
        session.setStatus(TeamAllocationSessionStatus.PUBLISHED);
        entityManager.persist(session);
        ProjectTeam result = new ProjectTeam();
        result.setTrainingClass(trainingClass);
        result.setAllocationSession(session);
        result.setTeamName(name);
        result.setProject(project);
        result.setMaxMembers(7);
        result.setStatus(ProjectTeamStatus.ACTIVE);
        return teams.saveAndFlush(result);
    }

    private String token(String email) {
        var principal = userDetails.loadUserByUsername(email);
        return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    private String request() throws Exception {
        return json.writeValueAsString(Map.of("projectId", team.getProject().getId(), "teamId", team.getId()));
    }

    private JsonNode readCharter(String token) throws Exception {
        return json.readTree(mvc.perform(get("/api/project-hub/teams/{id}/charter", team.getId())
                .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    private org.springframework.test.web.servlet.ResultActions saveCharter(String token, long version, String mission) throws Exception {
        return mvc.perform(put("/api/project-hub/teams/{id}/charter", team.getId())
                .header("Authorization", "Bearer " + token).header("X-Correlation-ID", "charter-test")
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(
                        new ProjectHubDtos.Charter(mission, "Tests pass", "Teams", "19:00-21:00", "Discuss with mentor", version))));
    }

    private void saveCompleteCharter() throws Exception {
        JsonNode current = readCharter(adminToken);
        var duties = new java.util.ArrayList<ProjectHubDtos.ResponsibilityInput>();
        current.get("members").forEach(m -> duties.add(new ProjectHubDtos.ResponsibilityInput(m.get("membershipId").asLong(), "Implement and test the agreed module.")));
        mvc.perform(put("/api/project-hub/teams/{id}/charter", team.getId()).header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new ProjectHubDtos.Charter(
                        "Deliver the team project", "Reviewed and tested", "Slack", "19:00-21:00", "Discuss, agree, escalate to Mentor",
                        current.get("charter").get("version").asLong(), duties)))).andExpect(status().isOk());
    }

    private JsonNode consentRequest(JsonNode current) {
        return json.valueToTree(new ProjectHubDtos.ConfirmCharter(current.get("charter").get("version").asLong(), current.get("revision").asLong(), current.get("rosterToken").asText()));
    }

    private org.springframework.test.web.servlet.ResultActions confirmCharter(String token, JsonNode request) throws Exception {
        return mvc.perform(post("/api/project-hub/teams/{id}/charter/confirm", team.getId()).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(request.toString()));
    }

    private void asAdmin(java.util.function.Consumer<org.springframework.security.core.Authentication> action) {
        var principal = userDetails.loadUserByUsername("admin@example.com");
        var auth = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);
        try { action.accept(auth); } finally { org.springframework.security.core.context.SecurityContextHolder.clearContext(); }
    }

    @Test
    void incompleteSavedContentNeedsReviewEvenWhenRolesAndResponsibilitiesAreValid() throws Exception {
        saveCompleteCharter();
        JsonNode current = readCharter(adminToken);
        saveCharter(adminToken, current.path("charter").path("version").asLong(), "").andExpect(status().isOk());
        JsonNode incomplete = readCharter(studentToken);
        assertThat(incomplete.path("progress").asText()).isEqualTo("NEEDS_REVIEW");
        assertThat(incomplete.path("contentComplete").asBoolean()).isFalse();
        assertThat(incomplete.path("canConfirm").asBoolean()).isFalse();
        assertThat(incomplete.path("confirmationBlockReason").asText()).contains("five charter fields");
        confirmCharter(studentToken, consentRequest(incomplete)).andExpect(status().isUnprocessableEntity());
        saveCharter(adminToken, incomplete.path("charter").path("version").asLong(), "Complete mission").andExpect(status().isOk());
        assertThat(readCharter(studentToken).path("progress").asText()).isEqualTo("PENDING");
        assertThat(readCharter(studentToken).path("contentComplete").asBoolean()).isTrue();
    }

    @Test
    void charterReturnsConfiguredTenantZoneAndReadOnlyMetadataWithoutCreatingEvidence() throws Exception {
        JsonNode initial = readCharter(adminToken);
        assertThat(initial.path("timeZone").asText()).isEqualTo("Asia/Tokyo");
        assertThat(initial.path("contentComplete").asBoolean()).isFalse();
        assertThat(charterRevisions.countByTeam_Id(team.getId())).isZero();
        saveCompleteCharter();
        JsonNode saved = readCharter(studentToken);
        assertThat(saved.path("contentComplete").asBoolean()).isTrue();
        confirmCharter(studentToken, consentRequest(saved)).andExpect(status().isOk())
                .andExpect(jsonPath("$.timeZone").value("Asia/Tokyo"))
                .andExpect(jsonPath("$.contentComplete").value(true));
        mvc.perform(get("/api/project-hub/charter-teams").header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].timeZone").value("Asia/Tokyo"));
        assertThat(charterRevisions.countByTeam_Id(team.getId())).isEqualTo(1);
        assertThat(charterConfirmations.findByTeamIdAndRevisionNumber(team.getId(), saved.path("revision").asLong())).hasSize(1);
    }

    @Test
    void historyKeepsNewestFirstAndServerPaginationTotals() throws Exception {
        saveCompleteCharter();
        for (int revision = 2; revision <= 3; revision++) {
            JsonNode current = readCharter(adminToken);
            saveCharter(adminToken, current.path("charter").path("version").asLong(), "Snapshot " + revision).andExpect(status().isOk());
        }
        mvc.perform(get("/api/project-hub/teams/{id}/charter/history", team.getId())
                .header("Authorization", "Bearer " + studentToken).param("page", "0").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(3)).andExpect(jsonPath("$.content[0].revision").value(3))
                .andExpect(jsonPath("$.content[0].charter.mission").value("Snapshot 3"));
        mvc.perform(get("/api/project-hub/teams/{id}/charter/history", team.getId())
                .header("Authorization", "Bearer " + studentToken).param("page", "1").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].revision").value(2))
                .andExpect(jsonPath("$.content[0].charter.mission").value("Snapshot 2"));
        mvc.perform(get("/api/project-hub/teams/{id}/charter/history", team.getId())
                .header("Authorization", "Bearer " + studentToken).param("page", "9").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content").isEmpty()).andExpect(jsonPath("$.totalElements").value(3));
        mvc.perform(get("/api/project-hub/teams/{id}/charter/history", team.getId())
                .header("Authorization", "Bearer " + studentToken).param("page", "-1"))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void softDeletedTeamIsHiddenWhileItsCharterEvidenceRemainsIntact() throws Exception {
        saveCompleteCharter();
        JsonNode current = readCharter(studentToken);
        confirmCharter(studentToken, consentRequest(current)).andExpect(status().isOk());
        transaction.executeWithoutResult(status -> {
            ProjectTeam deleted = teams.findById(team.getId()).orElseThrow();
            deleted.setIsActive(false);
            teams.saveAndFlush(deleted);
        });
        mvc.perform(get("/api/project-hub/charter-teams").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.teamId == " + team.getId() + ")]").isEmpty());
        mvc.perform(get("/api/project-hub/teams/{id}/charter", team.getId()).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/project-hub/teams/{id}/charter/history", team.getId()).header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isNotFound());
        confirmCharter(studentToken, consentRequest(current)).andExpect(status().isNotFound());
        assertThat(charterRevisions.countByTeam_Id(team.getId())).isEqualTo(1);
        assertThat(charterConfirmations.findByTeamIdAndRevisionNumber(team.getId(), 1L)).hasSize(1);
    }

    @Test
    void selfConfirmationIsImmutableIdempotentAndCannotImpersonateAnotherUser() throws Exception {
        saveCompleteCharter();
        JsonNode current = readCharter(studentToken);
        assertThat(current.get("canConfirm").asBoolean()).isTrue();
        var request = (com.fasterxml.jackson.databind.node.ObjectNode) consentRequest(current);
        Long adminId = transaction.execute(status -> users.findByEmail("admin@example.com").orElseThrow().getId());
        request.put("userId", adminId.longValue());
        String first = confirmCharter(studentToken, request).andExpect(status().isOk()).andExpect(jsonPath("$.progress").value("FULLY_CONFIRMED"))
                .andExpect(jsonPath("$.confirmedCount").value(1)).andReturn().getResponse().getContentAsString();
        String retry = confirmCharter(studentToken, request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(retry)).isEqualTo(json.readTree(first));
        var evidence = charterConfirmations.findByTeamIdAndRevisionNumber(team.getId(), 1L);
        assertThat(evidence).hasSize(1);
        assertThat(evidence.getFirst().getUserId()).isEqualTo(transaction.execute(status -> users.findByEmail("student@example.com").orElseThrow().getId()));
        assertThat(charterOutbox.findAll().stream().filter(e -> e.getAggregateId().equals(team.getId()) && e.getEventType().equals("TEAM_CHARTER_CONFIRMED")).toList()).hasSize(1);
    }

    @Test
    void charterRevisionChangeRequiresNewConsentAndPreservesHistory() throws Exception {
        saveCompleteCharter(); JsonNode old = readCharter(studentToken);
        confirmCharter(studentToken, consentRequest(old)).andExpect(status().isOk());
        saveCharter(adminToken, old.get("charter").get("version").asLong(), "Changed mission").andExpect(status().isOk());
        JsonNode updated = readCharter(studentToken);
        assertThat(updated.get("revision").asLong()).isEqualTo(2);
        assertThat(updated.get("confirmedCount").asInt()).isZero();
        confirmCharter(studentToken, consentRequest(old)).andExpect(status().isConflict());
        mvc.perform(get("/api/project-hub/teams/{id}/charter/history", team.getId()).header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].revision").value(2))
                .andExpect(jsonPath("$.content[1].charter.mission").value("Deliver the team project"))
                .andExpect(jsonPath("$.content[1].confirmations.length()").value(1));
    }

    @Test
    void incompleteContentResponsibilitiesOrInvalidRoleBlocksConsent() throws Exception {
        long version = readCharter(adminToken).get("charter").get("version").asLong();
        saveCharter(adminToken, version, "Incomplete responsibility").andExpect(status().isOk());
        var read = readCharter(studentToken);
        assertThat(read.get("canConfirm").asBoolean()).isFalse();
        confirmCharter(studentToken, consentRequest(read)).andExpect(status().isUnprocessableEntity());
        saveCompleteCharter();
        transaction.executeWithoutResult(status -> members.findAllByTeam_IdOrderByIdAsc(team.getId()).getFirst().setRole(null));
        assertThat(readCharter(adminToken).get("confirmedCount").asInt()).isZero();
        assertThat(readCharter(studentToken).get("canConfirm").asBoolean()).isFalse();
    }

    @Test
    void adminAndAssignedMentorCannotConfirmOnBehalfOfStudents() throws Exception {
        saveCompleteCharter(); var request = consentRequest(readCharter(studentToken));
        confirmCharter(adminToken, request).andExpect(status().isForbidden());
        transaction.executeWithoutResult(status -> teams.findById(team.getId()).orElseThrow().setAssignedMentorId(teacherId));
        String teacher = token("teacher@example.com");
        confirmCharter(teacher, consentRequest(readCharter(teacher))).andExpect(status().isForbidden());
        assertThat(charterConfirmations.findByTeamIdAndRevisionNumber(team.getId(), 1L)).isEmpty();
    }

    @Test
    void leaderCanEditWithoutGrantingTeamUpdateToOrdinaryMembers() throws Exception {
        transaction.executeWithoutResult(status -> {
            var membership = members.findAllByTeam_IdOrderByIdAsc(team.getId()).getFirst();
            teams.findById(team.getId()).orElseThrow().setLeaderMemberId(membership.getClassMember().getId());
        });
        var leader = readCharter(studentToken);
        assertThat(leader.get("canEdit").asBoolean()).isTrue();
        saveCharter(studentToken, leader.get("charter").get("version").asLong(), "Leader-owned agreement").andExpect(status().isOk());
    }

    @Test
    void officialRoleChangeInvalidatesConsentAtomically() throws Exception {
        saveCompleteCharter(); confirmCharter(studentToken, consentRequest(readCharter(studentToken))).andExpect(status().isOk());
        long version = readCharter(adminToken).get("charter").get("version").asLong();
        Long memberId = transaction.execute(status -> members.findAllByTeam_IdOrderByIdAsc(team.getId()).getFirst().getClassMember().getId());
        asAdmin(auth -> roleService.updateRoles(team.getTrainingClass().getId(), team.getAllocationSession().getId(), team.getId(),
                new UpdateTeamRolesRequest(version, List.of(new UpdateTeamRolesRequest.MemberRoleAssignment(memberId, "QA"))), auth));
        JsonNode changed = readCharter(studentToken);
        assertThat(changed.get("revision").asLong()).isEqualTo(2);
        assertThat(changed.get("confirmedCount").asInt()).isZero();
        assertThat(changed.get("members").get(0).get("roles").get(0).asText()).isEqualTo("QA");
        assertThat(changed.get("canConfirm").asBoolean()).isTrue();
        assertThat(charterConfirmations.findByTeamIdAndRevisionNumber(team.getId(), 1L)).hasSize(1);
    }

    @Test
    void officialMemberRemovalPreservesConsentEvidenceAndNeverShowsZeroOfZeroAsComplete() throws Exception {
        saveCompleteCharter(); confirmCharter(studentToken, consentRequest(readCharter(studentToken))).andExpect(status().isOk());
        Long memberId = transaction.execute(status -> members.findAllByTeam_IdOrderByIdAsc(team.getId()).getFirst().getClassMember().getId());
        asAdmin(auth -> membershipService.removeMember(team.getTrainingClass().getId(), team.getAllocationSession().getId(), team.getId(), memberId,
                new RemoveActiveTeamMemberRequest("Student moved to another group"), auth));
        JsonNode changed = readCharter(adminToken);
        assertThat(changed.get("revision").asLong()).isEqualTo(2);
        assertThat(changed.get("memberCount").asInt()).isZero();
        assertThat(changed.get("progress").asText()).isEqualTo("NEEDS_REVIEW");
        assertThat(charterConfirmations.findByTeamIdAndRevisionNumber(team.getId(), 1L)).hasSize(1);
    }

    @Test
    void membershipStatusReactivationDoesNotResurrectOldConsent() throws Exception {
        saveCompleteCharter(); confirmCharter(studentToken, consentRequest(readCharter(studentToken))).andExpect(status().isOk());
        transaction.executeWithoutResult(status -> members.findAllByTeam_IdOrderByIdAsc(team.getId()).getFirst().getClassMember().setStatus(ClassMemberStatus.INACTIVE));
        assertThat(readCharter(adminToken).get("confirmedCount").asInt()).isZero();
        transaction.executeWithoutResult(status -> members.findAllByTeam_IdOrderByIdAsc(team.getId()).getFirst().getClassMember().setStatus(ClassMemberStatus.ACTIVE));
        var read = readCharter(studentToken);
        assertThat(read.get("confirmedCount").asInt()).isZero();
        assertThat(read.get("canConfirm").asBoolean()).isFalse();
    }

    @Test
    void concurrentConfirmRetriesProduceOnlyOneConsent() throws Exception {
        saveCompleteCharter(); var request = consentRequest(readCharter(studentToken));
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var a = executor.submit(() -> confirmCharter(studentToken, request).andReturn().getResponse().getStatus());
            var b = executor.submit(() -> confirmCharter(studentToken, request).andReturn().getResponse().getStatus());
            assertThat(List.of(a.get(20, java.util.concurrent.TimeUnit.SECONDS), b.get(20, java.util.concurrent.TimeUnit.SECONDS))).containsExactly(200, 200);
        }
        assertThat(charterConfirmations.findByTeamIdAndRevisionNumber(team.getId(), 1L)).hasSize(1);
    }

    @Test
    void classOf35StudentsShowsFiveIndependentGroupsOfSeven() throws Exception {
        List<Long> groupIds = transaction.execute(status -> {
            var firstMember = members.findAllByTeam_IdOrderByIdAsc(team.getId()).getFirst();
            var firstClassMember = firstMember.getClassMember();
            var trainingClass = firstClassMember.getTrainingClass();
            var session = teams.findById(team.getId()).orElseThrow().getAllocationSession();
            var tenant = firstClassMember.getUser().getTenant();
            var role = roles.findByName("STUDENT").orElseThrow();
            List<Long> result = new java.util.ArrayList<>();
            for (int group = 0; group < 5; group++) {
                var target = group == 0 ? teams.findById(team.getId()).orElseThrow() : teams.saveAndFlush(ProjectTeam.builder()
                        .trainingClass(trainingClass).allocationSession(session).teamName("Group " + group).maxMembers(7).status(ProjectTeamStatus.ACTIVE).build());
                result.add(target.getId());
                for (int slot = group == 0 ? 1 : 0; slot < 7; slot++) {
                    User student = new User(); student.setEmail("charter-" + UUID.randomUUID() + "@example.test");
                    student.setUsername("tc" + UUID.randomUUID()); student.setFirstName("Student"); student.setLastName(group + "-" + slot);
                    student.setTenant(tenant); student.setPasswordHash("test-fixture-only"); student.setRoles(new java.util.HashSet<>(List.of(role)));
                    users.saveAndFlush(student);
                    ClassMember cm = new ClassMember(); cm.setTrainingClass(trainingClass); cm.setUser(student); cm.setStatus(ClassMemberStatus.ACTIVE); entityManager.persist(cm);
                    members.saveAndFlush(ProjectMember.builder().team(target).classMember(cm).role("DEV").build());
                }
            }
            return result;
        });
        JsonNode all = json.readTree(mvc.perform(get("/api/project-hub/charter-teams").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        int matching = 0;
        for (JsonNode row : all) if (groupIds.contains(row.get("teamId").asLong())) { matching++; assertThat(row.get("memberCount").asInt()).isEqualTo(7); assertThat(row.get("confirmedCount").asInt()).isZero(); }
        assertThat(matching).isEqualTo(5);
        JsonNode own = json.readTree(mvc.perform(get("/api/project-hub/charter-teams").header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        for (JsonNode row : own) assertThat(groupIds.subList(1, 5)).doesNotContain(row.get("teamId").asLong());
        assertThat(readCharter(studentToken).get("memberCount").asInt()).isEqualTo(7);
    }

    @Test
    void workspaceContextAndHistoryScopeAreValidated() throws Exception {
        mvc.perform(get("/api/project-hub/teams/{id}/charter", team.getId()).param("workspaceId", "999999999").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
        Long outside = transaction.execute(status -> createTeam(teamTenant(), null, "Other history").getId());
        mvc.perform(get("/api/project-hub/teams/{id}/charter/history", outside).header("Authorization", "Bearer " + studentToken)).andExpect(status().isNotFound());
        mvc.perform(get("/api/project-hub/teams/{id}/charter/history", team.getId()).param("size", "51").header("Authorization", "Bearer " + studentToken)).andExpect(status().isUnprocessableEntity());
        mvc.perform(get("/api/project-hub/teams/{id}/charter/history", team.getId()).header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void confirmationAndItsEvidenceRollBackTogether() throws Exception {
        saveCompleteCharter(); var current = readCharter(studentToken);
        var actor = userDetails.loadUserByUsername("student@example.com");
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(actor, null, actor.getAuthorities()));
        try {
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> transaction.executeWithoutResult(status -> {
                charterService.confirm(team.getId(), json.convertValue(consentRequest(current), ProjectHubDtos.ConfirmCharter.class));
                throw new IllegalStateException("Failure before commit");
            })).isInstanceOf(IllegalStateException.class).hasMessage("Failure before commit");
        } finally { org.springframework.security.core.context.SecurityContextHolder.clearContext(); }
        assertThat(charterConfirmations.findByTeamIdAndRevisionNumber(team.getId(), 1L)).isEmpty();
        assertThat(readCharter(studentToken).get("confirmedCount").asInt()).isZero();
        assertThat(charterOutbox.findAll().stream().filter(e -> e.getAggregateId().equals(team.getId()) && e.getEventType().equals("TEAM_CHARTER_CONFIRMED")).toList()).isEmpty();
    }

    @Test
    void charterReadUsesCanonicalTeamAndSeparatesReadFromWritePermission() throws Exception {
        JsonNode admin = readCharter(adminToken);
        assertThat(admin.get("canEdit").asBoolean()).isTrue();
        assertThat(admin.get("revision").asLong()).isZero();
        assertThat(admin.get("charter").get("version").isIntegralNumber()).isTrue();
        JsonNode student = readCharter(studentToken);
        assertThat(student.get("teamId").asLong()).isEqualTo(team.getId());
        assertThat(student.get("canEdit").asBoolean()).isFalse();
        saveCharter(studentToken, admin.get("charter").get("version").asLong(), "Not allowed")
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/project-hub/teams/{id}/charter", team.getId())).andExpect(status().isUnauthorized());
    }

    @Test
    void mentorNeedsTeamScopeInAdditionToUpdatePermission() throws Exception {
        String teacherToken = token("teacher@example.com");
        mvc.perform(get("/api/project-hub/teams/{id}/charter", team.getId()).header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isNotFound());
        mvc.perform(put("/api/project-hub/teams/{id}/charter", team.getId()).header("Authorization", "Bearer " + teacherToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new ProjectHubDtos.Charter("Outside scope", "", "", "", "", 0L))))
                .andExpect(status().isNotFound());
        transaction.executeWithoutResult(status -> teams.findById(team.getId()).orElseThrow().setAssignedMentorId(teacherId));
        JsonNode charter = readCharter(teacherToken);
        assertThat(charter.get("canEdit").asBoolean()).isTrue();
        saveCharter(teacherToken, charter.get("charter").get("version").asLong(), "Mentor edit").andExpect(status().isOk());
    }

    @Test
    void charterSaveCreatesOneRevisionAuditAndEventAndNormalizesContent() throws Exception {
        long version = readCharter(adminToken).get("charter").get("version").asLong();
        saveCharter(adminToken, version, "  Mission\r\nSecond line  ").andExpect(status().isOk())
                .andExpect(jsonPath("$.charter.mission").value("Mission\nSecond line"))
                .andExpect(jsonPath("$.charter.primaryChannel").value("Microsoft Teams"));
        JsonNode saved = readCharter(adminToken);
        assertThat(saved.get("revision").asLong()).isEqualTo(1);
        assertThat(saved.get("charter").get("version").asLong()).isGreaterThan(version);
        transaction.executeWithoutResult(status -> {
            var revisions = charterRevisions.findAll().stream().filter(r -> r.getTeam().getId().equals(team.getId())).toList();
            assertThat(revisions).hasSize(1);
            assertThat(revisions.getFirst().getCorrelationId()).isEqualTo("charter-test");
            assertThat(revisions.getFirst().getSavedAt()).isNotNull();
            assertThat(revisions.getFirst().getContentJson()).contains("Mission\\nSecond line");
            assertThat(charterAudits.findAll().stream().filter(a -> a.getClassId().equals(team.getTrainingClass().getId())
                    && a.getAction().equals("UPDATE_TEAM_CHARTER")).toList()).hasSize(1);
            assertThat(charterOutbox.findAll().stream().filter(e -> e.getAggregateId().equals(team.getId())
                    && e.getEventType().equals("TEAM_CHARTER_UPDATED")).toList()).hasSize(1);
        });
    }

    @Test
    void charterNoOpDoesNotAdvanceRevisionVersionOrDuplicateEvidence() throws Exception {
        long firstVersion = readCharter(adminToken).get("charter").get("version").asLong();
        saveCharter(adminToken, firstVersion, "Mission").andExpect(status().isOk());
        JsonNode before = readCharter(adminToken);
        saveCharter(adminToken, before.get("charter").get("version").asLong(), " Mission ").andExpect(status().isOk());
        assertThat(readCharter(adminToken)).isEqualTo(before);
        assertThat(charterRevisions.countByTeam_Id(team.getId())).isEqualTo(1);
    }

    @Test
    void staleSaveCannotOverwriteCurrentCharterAndKeepsPreviousSnapshot() throws Exception {
        long version = readCharter(adminToken).get("charter").get("version").asLong();
        saveCharter(adminToken, version, "First edit").andExpect(status().isOk());
        saveCharter(adminToken, version, "Stale edit").andExpect(status().isConflict());
        JsonNode current = readCharter(adminToken);
        assertThat(current.get("charter").get("mission").asText()).isEqualTo("First edit");
        saveCharter(adminToken, current.get("charter").get("version").asLong(), "Second edit").andExpect(status().isOk());
        transaction.executeWithoutResult(status -> {
            var snapshots = charterRevisions.findAll().stream().filter(r -> r.getTeam().getId().equals(team.getId()))
                    .sorted(java.util.Comparator.comparing(com.example.starter_project_2025.system.project.charter.TeamCharterRevision::getRevisionNumber)).toList();
            assertThat(snapshots).hasSize(2);
            assertThat(snapshots.getFirst().getContentJson()).contains("First edit").doesNotContain("Second edit");
        });
    }

    @Test
    void charterRequiresVersionAndRejectsOversizedFieldsWithoutSideEffects() throws Exception {
        mvc.perform(put("/api/project-hub/teams/{id}/charter", team.getId()).header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content("{\"mission\":\"Legacy client\"}"))
                .andExpect(status().isUnprocessableEntity());
        long version = readCharter(adminToken).get("charter").get("version").asLong();
        saveCharter(adminToken, version, "a".repeat(2001)).andExpect(status().isUnprocessableEntity());
        var invalid = new ProjectHubDtos.Charter("", "", "Slack", "x".repeat(256), "", version);
        mvc.perform(put("/api/project-hub/teams/{id}/charter", team.getId()).header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(invalid)))
                .andExpect(status().isUnprocessableEntity());
        assertThat(charterRevisions.countByTeam_Id(team.getId())).isZero();
    }

    @Test
    void incompleteDraftAndCharacterBoundaryCanBeSaved() throws Exception {
        long version = readCharter(adminToken).get("charter").get("version").asLong();
        var draft = new ProjectHubDtos.Charter("a".repeat(2000), null, "", "", null, version);
        mvc.perform(put("/api/project-hub/teams/{id}/charter", team.getId()).header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(draft)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.charter.definitionOfDone").value(""));
    }

    @Test
    void allFiveCharterFieldsEnforceTheirOwnCharacterLimits() throws Exception {
        long version = readCharter(adminToken).get("charter").get("version").asLong();
        for (var limit : Map.of("mission", 2000, "definitionOfDone", 2000, "primaryChannel", 255,
                "coreHours", 255, "conflictResolution", 2000).entrySet()) {
            var body = new java.util.HashMap<String, Object>();
            body.put("version", version);
            body.put(limit.getKey(), "x".repeat(limit.getValue() + 1));
            mvc.perform(put("/api/project-hub/teams/{id}/charter", team.getId()).header("Authorization", "Bearer " + adminToken)
                    .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                    .andExpect(status().isUnprocessableEntity());
        }
        assertThat(readCharter(adminToken).get("charter").get("version").asLong()).isEqualTo(version);
        assertThat(charterRevisions.countByTeam_Id(team.getId())).isZero();
    }

    @Test
    void charterContentEvidenceAndEventsRollBackTogether() throws Exception {
        long version = readCharter(adminToken).get("charter").get("version").asLong();
        var principal = userDetails.loadUserByUsername("admin@example.com");
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        try {
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> transaction.executeWithoutResult(status -> {
                charterService.save(team.getId(), new ProjectHubDtos.Charter("Must roll back", "", "Slack", "", "", version));
                throw new IllegalStateException("Simulated transaction failure");
            })).isInstanceOf(IllegalStateException.class).hasMessage("Simulated transaction failure");
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
        }
        assertThat(readCharter(adminToken).get("charter").get("version").asLong()).isEqualTo(version);
        assertThat(charterRevisions.countByTeam_Id(team.getId())).isZero();
        assertThat(charterAudits.findAll().stream().filter(a -> a.getClassId().equals(team.getTrainingClass().getId())
                && a.getAction().equals("UPDATE_TEAM_CHARTER")).toList()).isEmpty();
        assertThat(charterOutbox.findAll().stream().filter(e -> e.getAggregateId().equals(team.getId())
                && e.getEventType().equals("TEAM_CHARTER_UPDATED")).toList()).isEmpty();
    }

    @Test
    void archivedTeamIsReadableButCannotBeChanged() throws Exception {
        transaction.executeWithoutResult(status -> teams.findById(team.getId()).orElseThrow().setStatus(ProjectTeamStatus.ARCHIVED));
        JsonNode read = readCharter(adminToken);
        assertThat(read.get("canEdit").asBoolean()).isFalse();
        saveCharter(adminToken, read.get("charter").get("version").asLong(), "Not allowed").andExpect(status().isConflict());
        assertThat(charterRevisions.countByTeam_Id(team.getId())).isZero();
    }

    @Test
    void studentCannotReadAnotherTeamsCharterAndInactiveClassIsHidden() throws Exception {
        Long outside = transaction.execute(status -> createTeam(teamTenant(), null, "Outside charter").getId());
        mvc.perform(get("/api/project-hub/teams/{id}/charter", outside).header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isNotFound());
        transaction.executeWithoutResult(status -> entityManager.find(TrainingClass.class, team.getTrainingClass().getId()).setIsActive(false));
        mvc.perform(get("/api/project-hub/teams/{id}/charter", team.getId()).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
    }

    private Tenant teamTenant() {
        return users.findByEmail("admin@example.com").orElseThrow().getTenant();
    }

    @Test
    void charterRejectsCrossTenantAccessEvenForAdmin() throws Exception {
        Long foreign = transaction.execute(status -> {
            Tenant tenant = tenants.saveAndFlush(Tenant.builder().code("CHARTER-" + UUID.randomUUID()).name("Other tenant").build());
            return createTeam(tenant, null, "Private charter").getId();
        });
        mvc.perform(get("/api/project-hub/teams/{id}/charter", foreign).header("Authorization", "Bearer " + adminToken)).andExpect(status().isNotFound());
        mvc.perform(put("/api/project-hub/teams/{id}/charter", foreign).header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new ProjectHubDtos.Charter("Leak", "", "", "", "", 0L))))
                .andExpect(status().isNotFound());
        assertThat(charterRevisions.countByTeam_Id(foreign)).isZero();
    }

    @Test
    void concurrentCharterSavesHaveOnlyOneWinner() throws Exception {
        long version = readCharter(adminToken).get("charter").get("version").asLong();
        var ready = new java.util.concurrent.CountDownLatch(2);
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<Integer> first = () -> { ready.countDown(); start.await(); return saveCharter(adminToken, version, "Concurrent A").andReturn().getResponse().getStatus(); };
            java.util.concurrent.Callable<Integer> second = () -> { ready.countDown(); start.await(); return saveCharter(adminToken, version, "Concurrent B").andReturn().getResponse().getStatus(); };
            var a = executor.submit(first);
            var b = executor.submit(second);
            assertThat(ready.await(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(List.of(a.get(20, java.util.concurrent.TimeUnit.SECONDS), b.get(20, java.util.concurrent.TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(200, 409);
        }
        assertThat(charterRevisions.countByTeam_Id(team.getId())).isEqualTo(1);
    }

    @Test
    void retiredBuilderEndpointsAreUnavailableAndCleanupPreservesSharedPermissions() throws Exception {
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
        // Cleanup hides retired navigation; template permission is still used by the active module.
        assertThat(permissions.findByName("PROJECT_TEMPLATE_READ").orElseThrow().getIsActive()).isTrue();
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
        Long version = transaction.execute(status -> teams.findById(team.getId()).orElseThrow().getVersion());
        String charter = json.writeValueAsString(new ProjectHubDtos.Charter("Ship a usable portal", "Tests pass", "Teams", "19:00–21:00", "Discuss with mentor", version));
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
        Long version = transaction.execute(status -> teams.findById(team.getId()).orElseThrow().getVersion());
        var valid = new ProjectHubDtos.Charter("Mission", "Tests pass", "Slack", "", "", version);
        mvc.perform(put("/api/project-hub/teams/{id}/charter", team.getId()).header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(valid)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.charter.primaryChannel").value("Slack")).andExpect(jsonPath("$.projectId").isEmpty());
        Long updatedVersion = transaction.execute(status -> teams.findById(team.getId()).orElseThrow().getVersion());
        mvc.perform(put("/api/project-hub/teams/{id}/charter", team.getId()).header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new ProjectHubDtos.Charter("Changed mission", "", "Arbitrary text", "", "", updatedVersion))))
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
            ProjectTeam foreignTeam = createTeam(foreign, project, "Private team");
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
            return createTeam(student.getTenant(), null, "Outside team").getId();
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
