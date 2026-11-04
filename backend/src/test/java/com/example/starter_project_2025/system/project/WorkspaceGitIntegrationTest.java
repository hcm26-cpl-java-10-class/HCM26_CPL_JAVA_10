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
import java.time.Instant;
import java.math.BigDecimal;
import com.example.starter_project_2025.system.project.workspace.git.*;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceAudit;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceAuditRepository;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneArtifactSubmission;
import jakarta.persistence.EntityManager;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.workspace.sections.mock-controls.enabled=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WorkspaceGitIntegrationTest {
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



    @Autowired ProjectGitConfigRepository configs;
    @org.springframework.boot.test.mock.mockito.SpyBean WorkspaceAuditRepository audits;
    @Autowired EntityManager entities;
    @Autowired ClassStaffAssignmentRepository staffAssignments;
    void teacher() { tx.executeWithoutResult(status -> roles.findById(roleId).orElseThrow().setPermissions(new HashSet<>(permissions.findAll()))); }
    void grant(String... names) {
        tx.executeWithoutResult(status -> roles.findById(roleId).orElseThrow().setPermissions(
                new HashSet<>(Arrays.stream(names).map(name -> permissions.findByName(name).orElseThrow()).toList())));
    }
    String path() { return "/api/workspaces/" + workspaceId + "/git-config"; }
    JsonNode getConfig() throws Exception {
        return json.readTree(mvc.perform(get(path()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
    JsonNode save(long version, String url, String branch, int expected) throws Exception {
        return json.readTree(mvc.perform(put(path()).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                        "version", version, "repositoryUrl", url, "defaultBranch", branch))))
                .andExpect(status().is(expected)).andReturn().getResponse().getContentAsString());
    }
    List<WorkspaceAudit> gitAudits() { return audits.findByWorkspaceId(workspaceId).stream().filter(a -> a.getAction().startsWith("GIT_REPO_")).toList(); }
    void regularMember() {
        tx.executeWithoutResult(status -> {
            teams.findById(teamId).orElseThrow().setAssignedMentorId(null);
            memberships.findById(membershipId).orElseThrow().setRole("DEV");
        });
        grant("WORKSPACE_READ");
    }
    @Test void linkUpdateUnlinkRelinkPersistAndAuditWithoutChangingOldUrls() throws Exception {
        assertThat(getConfig().get("configured").asBoolean()).isFalse();
        var first = save(0, "git@github.com:team/repo-a.git", "main", 200);
        assertThat(first.get("version").asLong()).isEqualTo(1);
        assertThat(first.get("repositoryWebUrl").asText()).isEqualTo("https://github.com/team/repo-a");
        assertThat(getConfig().get("repositoryUrl").asText()).isEqualTo("git@github.com:team/repo-a.git");
        save(1, "git@github.com:team/repo-a.git", "main", 200);
        assertThat(gitAudits()).hasSize(1);
        save(1, "https://gitlab.com/group/sub/repo-b.git", "dev", 200);
        var updated = gitAudits().stream().filter(a -> a.getAction().equals("GIT_REPO_UPDATED")).findFirst().orElseThrow();
        assertThat(updated.getBeforeJson()).contains("repo-a");
        assertThat(updated.getAfterJson()).contains("repo-b", "dev");
        assertThat(updated.getActorId()).isEqualTo(actorId);
        assertThat(updated.getCorrelationId()).isNotBlank();
        mvc.perform(delete(path()).param("version", "1").header("Authorization", "Bearer " + token)).andExpect(status().isConflict());
        mvc.perform(delete(path()).param("version", "2").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        assertThat(getConfig().get("configured").asBoolean()).isFalse();
        assertThat(getConfig().get("version").asLong()).isEqualTo(3);
        assertThat(gitAudits()).hasSize(3);
        save(0, "https://github.com/team/c", "main", 409);
        save(3, "https://github.com/team/c", "main", 200);
        assertThat(configs.count()).isGreaterThanOrEqualTo(1);
        assertThat(configs.findById(workspaceId).orElseThrow().getVersion()).isEqualTo(4);
    }
    @Test void ordinaryMemberCanViewButCannotWriteEvenByCallingApiDirectly() throws Exception {
        save(0, "https://github.com/team/repo", "main", 200);
        regularMember();
        var view = getConfig();
        assertThat(view.get("configured").asBoolean()).isTrue();
        assertThat(view.get("canEdit").asBoolean()).isFalse();
        assertThat(view.get("canUnlink").asBoolean()).isFalse();
        save(1, "https://github.com/team/other", "main", 403);
        mvc.perform(delete(path()).param("version", "1").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        assertThat(gitAudits()).hasSize(1);
    }
    @Test void multiRoleLeaderAndExplicitEditorCanWriteButRevocationAppliesImmediately() throws Exception {
        regularMember();
        tx.executeWithoutResult(status -> memberships.findById(membershipId).orElseThrow().setRole("PM,BA"));
        assertThat(getConfig().get("canEdit").asBoolean()).isTrue();
        save(0, "https://github.com/team/repo", "main", 200);
        tx.executeWithoutResult(status -> memberships.findById(membershipId).orElseThrow().setRole("DEV"));
        save(1, "https://github.com/team/repo", "dev", 403);
        grant("WORKSPACE_READ", "WORKSPACE_UPDATE");
        save(1, "https://github.com/team/repo", "dev", 200);
        grant("WORKSPACE_READ");
        assertThat(getConfig().get("canEdit").asBoolean()).isFalse();
        save(2, "https://github.com/team/repo", "main", 403);
    }
    @Test void onlyCurrentlyAssignedMentorCanEdit() throws Exception {
        grant("WORKSPACE_READ");
        tx.executeWithoutResult(status -> memberships.findById(membershipId).orElseThrow().setIsActive(false));
        save(0, "https://github.com/team/repo", "main", 200);
        tx.executeWithoutResult(status -> teams.findById(teamId).orElseThrow().setAssignedMentorId(null));
        mvc.perform(get(path()).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        save(1, "https://github.com/team/repo", "dev", 403);
    }
    @Test void invalidInputNeverChangesConfigOrAuditAndDoesNotEchoSecrets() throws Exception {
        save(0, "https://github.com/team/repo", "main", 200);
        var error = save(1, "https://secret:password@github.com/team/other", "main", 422);
        assertThat(error.toString()).doesNotContain("secret", "password");
        assertThat(error.get("errors").has("repositoryUrl")).isTrue();
        save(1, "https://github.com/team/other", "bad..branch", 422);
        save(1, "", "main", 422);
        assertThat(getConfig().get("repositoryUrl").asText()).isEqualTo("https://github.com/team/repo");
        assertThat(gitAudits()).hasSize(1);
    }
    @Test void staleUpdatesIncludingConcurrentFirstSaveDoNotOverwrite() throws Exception {
        save(0, "https://github.com/team/repo-a", "main", 200);
        save(0, "https://github.com/team/repo-b", "dev", 409);
        save(1, "https://github.com/team/repo-c", "main", 200);
        save(1, "https://github.com/team/repo-d", "dev", 409);
        assertThat(getConfig().get("repositoryUrl").asText()).endsWith("repo-c");
        assertThat(gitAudits()).hasSize(2);
    }
    @Test void outsidersCrossTenantAndInactiveAccountsCannotReadOrWrite() throws Exception {
        save(0, "https://github.com/team/repo", "main", 200);
        regularMember();
        tx.executeWithoutResult(status -> memberships.findById(membershipId).orElseThrow().setIsActive(false));
        mvc.perform(get(path()).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        save(1, "https://github.com/team/other", "main", 403);
        tx.executeWithoutResult(status -> {
            memberships.findById(membershipId).orElseThrow().setIsActive(true);
            var other = tenants.saveAndFlush(Tenant.builder().code("GIT-" + UUID.randomUUID()).name("Other tenant").build());
            users.findById(actorId).orElseThrow().setTenant(other);
        });
        mvc.perform(get(path()).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }
    @Test void teamOnlyWorkspaceCanLinkWithoutAProject() throws Exception {
        tx.executeWithoutResult(status -> {
            workspaces.findById(workspaceId).orElseThrow().setProject(null);
            teams.findById(teamId).orElseThrow().setProject(null);
        });
        save(0, "https://github.com/team/repo", "main", 200);
        assertThat(getConfig().get("configured").asBoolean()).isTrue();
    }
    @Test void twoConcurrentFirstSavesProduceOneWinnerAndOneAudit() throws Exception {
        var ready = new java.util.concurrent.CountDownLatch(2);
        var start = new java.util.concurrent.CountDownLatch(1);
        var pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            var calls = new ArrayList<java.util.concurrent.Future<Integer>>();
            for (String name : List.of("first", "second")) calls.add(pool.submit(() -> {
                ready.countDown(); start.await();
                return mvc.perform(put(path()).header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                        "version", 0, "repositoryUrl", "https://github.com/team/" + name, "defaultBranch", "main"))))
                    .andReturn().getResponse().getStatus();
            }));
            assertThat(ready.await(5, java.util.concurrent.TimeUnit.SECONDS)).isTrue(); start.countDown();
            assertThat(List.of(calls.get(0).get(15, java.util.concurrent.TimeUnit.SECONDS), calls.get(1).get(15, java.util.concurrent.TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(200, 409);
            assertThat(configs.findById(workspaceId).orElseThrow().getVersion()).isEqualTo(1);
            assertThat(gitAudits()).hasSize(1);
        } finally { start.countDown(); pool.shutdownNow(); }
    }
    @Test void auditFailureRollsBackNewConfigurationAndLeavesNoFalseSuccess() throws Exception {
        org.mockito.Mockito.doThrow(new IllegalStateException("Simulated audit failure"))
                .when(audits).saveAndFlush(org.mockito.ArgumentMatchers.any(WorkspaceAudit.class));
        mvc.perform(put(path()).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                    "version", 0, "repositoryUrl", "https://github.com/team/repo", "defaultBranch", "main"))))
                .andExpect(status().isInternalServerError());
        assertThat(configs.findById(workspaceId)).isEmpty();
        assertThat(getConfig().get("configured").asBoolean()).isFalse();
    }
    @Test void changingOrUnlinkingRepositoryDoesNotMutateSubmittedArtifactSnapshot() throws Exception {
        var snapshot = MilestoneArtifactSubmission.submit(tenantId, projectId, teamId, UUID.randomUUID(), UUID.randomUUID(),
                1, "https://github.com/team/original.git", null, "Original notes", "{}", "[]", Instant.now(), false, BigDecimal.ZERO);
        UUID id = tx.execute(status -> { entities.persist(snapshot); entities.flush(); return snapshot.getId(); });
        save(0, "https://github.com/team/original.git", "main", 200);
        save(1, "https://github.com/team/replacement.git", "dev", 200);
        mvc.perform(delete(path()).param("version", "2").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        tx.executeWithoutResult(status -> {
            entities.clear(); var old = entities.find(MilestoneArtifactSubmission.class, id);
            assertThat(old.getRepositoryUrl()).isEqualTo("https://github.com/team/original.git");
            assertThat(old.getReleaseNotes()).isEqualTo("Original notes");
            assertThat(old.getVersion()).isEqualTo(1);
            assertThat(old.getStatus().name()).isEqualTo("SUBMITTED");
        });
    }

    @Test void unrelatedWorkspaceDoesNotExposeAnotherTeamsRepositoryEvenWithBroadPermissions() throws Exception {
        save(0, "https://github.com/team/repo", "main", 200);
        Long otherWorkspaceId = tx.execute(status -> {
            var original = teams.findById(teamId).orElseThrow();
            var other = new ProjectTeam(); other.setTeamName("Other Git team"); other.setTrainingClass(original.getTrainingClass());
            other.setAllocationSession(original.getAllocationSession()); other.setMaxMembers(5); other.setStatus(ProjectTeamStatus.ACTIVE);
            var project = new Project(); project.setCode("GIT-" + UUID.randomUUID()); project.setName("Other team project");
            project.setTenant(original.getProject().getTenant()); project.setStatus(ProjectStatus.ACTIVE); project = projects.saveAndFlush(project);
            other.setProject(project); other = teams.saveAndFlush(other);
            var workspace = new Workspace(); workspace.setCode("GIT-" + UUID.randomUUID()); workspace.setName("Other workspace");
            workspace.setTeam(other); workspace.setProject(project); workspace.setTenant(project.getTenant());
            workspace.setStatus(com.example.starter_project_2025.system.project.workspace.domain.WorkspaceStatus.ACTIVE);
            return workspaces.saveAndFlush(workspace).getId();
        });
        mvc.perform(get("/api/workspaces/{id}/git-config", otherWorkspaceId).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        assertThat(configs.findById(otherWorkspaceId)).isEmpty();
    }
    @Test void anonymousAndMissingWorkspaceRequestsDoNotBecomeEmptyStates() throws Exception {
        mvc.perform(get(path())).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/workspaces/{id}/git-config", Long.MAX_VALUE).header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
    }
    @Test void revokedClassMembershipOrLockedAccountStopsReadAndWrite() throws Exception {
        regularMember();
        tx.executeWithoutResult(status -> memberships.findById(membershipId).orElseThrow().getClassMember().setStatus(ClassMemberStatus.INACTIVE));
        mvc.perform(get(path()).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        tx.executeWithoutResult(status -> {
            memberships.findById(membershipId).orElseThrow().getClassMember().setStatus(ClassMemberStatus.ACTIVE);
            users.findById(actorId).orElseThrow().setLocked(true);
        });
        mvc.perform(get(path()).header("Authorization", "Bearer " + token)).andExpect(status().is4xxClientError());
    }

    @Test void mismatchedStoredOwnershipDoesNotLeakOrOverwriteARepository() throws Exception {
        save(0, "https://github.com/team/repo", "main", 200);
        jdbc.update("update project_git_configs set team_id = ? where workspace_id = ?", Long.MAX_VALUE, workspaceId);
        mvc.perform(get(path()).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        save(1, "https://github.com/team/other", "main", 403);
        assertThat(gitAudits()).hasSize(1);
    }

    void administrativeReader() {
        regularMember();
        tx.executeWithoutResult(status -> {
            memberships.findById(membershipId).orElseThrow().setIsActive(false);
            users.findById(actorId).orElseThrow().setRoles(new HashSet<>(Set.of(roles.findByName("ADMIN").orElseThrow())));
            var principal = userDetails.loadUserByUsername(users.findById(actorId).orElseThrow().getEmail());
            token = tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        });
    }

    @Test void scopedAdminCanReadUpdateAndUnlinkRepositoryWithoutMembership() throws Exception {
        save(0, "https://github.com/team/repo", "main", 200);
        administrativeReader();
        mvc.perform(get("/api/workspaces/{id}", workspaceId).header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        var config = getConfig();
        assertThat(config.get("repositoryUrl").asText()).isEqualTo("https://github.com/team/repo");
        assertThat(config.get("canEdit").asBoolean()).isTrue();
        assertThat(config.get("canUnlink").asBoolean()).isTrue();
        save(1, "https://github.com/team/other", "dev", 200);
        mvc.perform(delete(path()).param("version", "2").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        assertThat(getConfig().get("configured").asBoolean()).isFalse();
        assertThat(gitAudits()).hasSize(3).allSatisfy(audit -> {
            assertThat(audit.getActorId()).isEqualTo(actorId);
            assertThat(audit.getWorkspaceId()).isEqualTo(workspaceId);
        });
    }

    @Test void adminCanAddFromEmptyStateButCannotReadOrWriteAcrossTenants() throws Exception {
        administrativeReader();
        var config = getConfig();
        assertThat(config.get("configured").asBoolean()).isFalse();
        assertThat(config.get("canEdit").asBoolean()).isTrue();
        save(0, "https://github.com/team/repo", "main", 200);
        tx.executeWithoutResult(status -> {
            var other = tenants.saveAndFlush(Tenant.builder().code("ADMIN-GIT-" + UUID.randomUUID()).name("Other tenant").build());
            users.findById(actorId).orElseThrow().setTenant(other);
        });
        mvc.perform(get(path()).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        save(1, "https://github.com/team/foreign", "main", 403);
        mvc.perform(delete(path()).param("version", "1").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        assertThat(configs.findById(workspaceId).orElseThrow().getRepositoryUrl()).isEqualTo("https://github.com/team/repo");
        assertThat(gitAudits()).hasSize(1);
    }

    @Test void adminEditRightsAreRevokedWithoutIssuingANewToken() throws Exception {
        administrativeReader();
        save(0, "https://github.com/team/repo", "main", 200);
        tx.executeWithoutResult(status -> users.findById(actorId).orElseThrow()
                .setRoles(new HashSet<>(Set.of(roles.findById(roleId).orElseThrow()))));
        save(1, "https://github.com/team/other", "main", 403);
        assertThat(configs.findById(workspaceId).orElseThrow().getRepositoryUrl()).isEqualTo("https://github.com/team/repo");
        assertThat(gitAudits()).hasSize(1);
    }

    @Test void assignedClassManagerCanReadButCannotEditAndLosesAccessAfterUnassignment() throws Exception {
        regularMember();
        Long assignment = tx.execute(status -> {
            memberships.findById(membershipId).orElseThrow().setIsActive(false);
            var staff = new ClassStaffAssignment();
            staff.setUser(users.findById(actorId).orElseThrow());
            staff.setTrainingClass(teams.findById(teamId).orElseThrow().getTrainingClass());
            staff.setRoleType(ClassStaffRoleType.CLASS_ADMIN);
            return staffAssignments.saveAndFlush(staff).getId();
        });
        assertThat(getConfig().get("canEdit").asBoolean()).isFalse();
        save(0, "https://github.com/team/repo", "main", 403);
        tx.executeWithoutResult(status -> staffAssignments.findById(assignment).orElseThrow().setIsActive(false));
        mvc.perform(get(path()).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }

}
