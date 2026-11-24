package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.git_integration.domain.GitCommit;
import com.example.starter_project_2025.system.git_integration.domain.GitCommitSource;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJob;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEventStatus;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationToken;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository;
import com.example.starter_project_2025.system.notification.Notification;
import com.example.starter_project_2025.system.notification.NotificationRepository;
import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.ProjectTeamStatus;
import com.example.starter_project_2025.system.project.TeamAllocationSession;
import com.example.starter_project_2025.system.project.TeamAllocationSessionRepository;
import com.example.starter_project_2025.system.project.TeamAllocationSessionStatus;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassRepository;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassStatus;
import com.example.starter_project_2025.system.rbac.user.User;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * US-GI-05 acceptance criteria: view and manage the repository linked to a master project
 * (GitHub mocked). Pam is the PM of the master's team, Alice a developer of it, Bob the PM of a
 * module's team.
 */
class RepositoryManageIntegrationTest extends AbstractTaskLinkIntegrationTest {

    private static final long OTHER_REPO = 9302L;

    @Autowired NotificationRepository notifications;
    @Autowired InstallationTokenProvider installationTokens;
    @Autowired TrainingClassRepository classes;
    @Autowired TeamAllocationSessionRepository allocationSessions;
    @Autowired ClassMemberRepository classMembers;
    @Autowired ProjectTeamRepository teams;
    @Autowired ProjectMemberRepository memberships;

    User pam;
    String pamToken;
    String aliceToken;
    String bobToken;
    Long installationRowId;

    @BeforeEach
    void members() {
        installationTokens.invalidate(GITHUB_INSTALLATION_ID);
        installationRowId = connections.findById(connectionId).orElseThrow().getInstallationRef();
        when(github.createInstallationToken(GITHUB_INSTALLATION_ID))
                .thenReturn(new GitHubInstallationToken("ghs_test", Instant.now().plusSeconds(3600)));
        tx.executeWithoutResult(status -> {
            Tenant tenant = tenants.findById(tenantId).orElseThrow();
            TrainingClass trainingClass = new TrainingClass();
            trainingClass.setCode("GI5-" + UUID.randomUUID());
            trainingClass.setName("GI-05 class");
            trainingClass.setTenantId(tenantId);
            trainingClass.setProgramId(1L);
            trainingClass.setStatus(TrainingClassStatus.ONGOING);
            classes.saveAndFlush(trainingClass);
            TeamAllocationSession session = new TeamAllocationSession();
            session.setTrainingClass(trainingClass);
            session.setMaxMembers(6);
            session.setStatus(TeamAllocationSessionStatus.PUBLISHED);
            allocationSessions.saveAndFlush(session);
            ProjectTeam masterTeam = team("Shop team", trainingClass, session, projects.findById(masterId).orElseThrow());
            ProjectTeam moduleTeam = team("Cart team", trainingClass, session, projects.findById(moduleId).orElseThrow());

            pam = person(tenant, "Pam");
            User alice = person(tenant, "Alice");
            User bob = person(tenant, "Bob");
            join(masterTeam, trainingClass, pam, "PM");
            join(masterTeam, trainingClass, alice, "DEV");
            join(moduleTeam, trainingClass, bob, "PM");
            pamToken = token(pam);
            aliceToken = token(alice);
            bobToken = token(bob);
        });
    }

    // ---- AC01 · View ------------------------------------------------------------------------------

    @Test
    void ac01TheLinkedRepositoryShowsItsStatusAndLastSyncAndOnlyThePmMayManageIt() throws Exception {
        LocalDateTime synced = LocalDateTime.now().minusMinutes(5).withNano(0);
        tx.executeWithoutResult(status -> connections.findById(connectionId).orElseThrow().setLastSyncedAt(synced));

        view(pamToken, masterId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.repository.fullName").value("hcm26-java-team/webshop"))
                .andExpect(jsonPath("$.repository.status").value("ACTIVE"))
                .andExpect(jsonPath("$.repository.lastSyncedAt").value(synced.toString()))
                .andExpect(jsonPath("$.canUnlink").value(true))
                .andExpect(jsonPath("$.canResync").value(false))
                .andExpect(jsonPath("$.canLink").value(false))
                .andExpect(jsonPath("$.previousRepositories", hasSize(0)));
        // A developer of the project only looks.
        view(aliceToken, masterId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.repository.status").value("ACTIVE"))
                .andExpect(jsonPath("$.canUnlink").value(false))
                .andExpect(jsonPath("$.canSync").value(false));
    }

    // ---- AC02 · Unlink ----------------------------------------------------------------------------

    @Test
    void ac02UnlinkStopsTheSyncKeepsTheHistoryAndIgnoresLaterWebhooks() throws Exception {
        storeCommit(connectionId, "a".repeat(40));
        Long pending = queueJob();

        unlink(pamToken, masterId, connectionId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.repository").doesNotExist())
                .andExpect(jsonPath("$.canLink").value(true))
                .andExpect(jsonPath("$.previousRepositories[0].id").value(connectionId))
                .andExpect(jsonPath("$.previousRepositories[0].commitCount").value(1))
                .andExpect(jsonPath("$.previousRepositories[0].unlinkedBy.id").value(pam.getId()));

        GitRepository row = connections.findById(connectionId).orElseThrow();
        assertThat(row.getStatus()).isEqualTo(GitRepositoryStatus.INACTIVE);
        assertThat(row.getStatusReason()).isEqualTo("UNLINKED_BY_USER");
        assertThat(row.getUnlinkedByUserId()).isEqualTo(pam.getId());
        assertThat(row.getUnlinkedAt()).isNotNull();
        assertThat(row.getActiveProjectId()).isNull();
        assertThat(commits.countByRepository_Id(connectionId)).isEqualTo(1); // history kept
        GitSyncJob job = jobs.findById(pending).orElseThrow();
        assertThat(job.getStatus()).isEqualTo(GitSyncJobStatus.FAILED);
        assertThat(job.getErrorCode()).isEqualTo("REPOSITORY_UNLINKED");

        push(commit("b".repeat(40), "After the unlink", "2026-11-22T10:00:00+07:00"));
        assertThat(commits.countByRepository_Id(connectionId)).isEqualTo(1);
        assertThat(events.findAll()).filteredOn(event -> "push".equals(event.getEventType()))
                .singleElement().satisfies(event -> assertThat(event.getStatus()).isEqualTo(GitWebhookEventStatus.IGNORED));

        // Unlinking again changes nothing (retry, double click).
        unlink(pamToken, masterId, connectionId).andExpect(status().isOk());
        // The unlinked repository's data still counts for the project, with its label.
        mvc.perform(get(url(masterId) + "/activity").header("Authorization", "Bearer " + pamToken))
                .andExpect(jsonPath("$.repositoryId").doesNotExist())
                .andExpect(jsonPath("$.commitCount").value(1))
                .andExpect(jsonPath("$.lastCommit.repository.status").value("INACTIVE"))
                .andExpect(jsonPath("$.repositories", hasSize(1)));
    }

    // ---- AC03 · Unlink without permission ------------------------------------------------------------

    @Test
    void ac03UnlinkWithoutThePermissionIsRefusedAndChangesNothing() throws Exception {
        long version = connections.findById(connectionId).orElseThrow().getVersion();

        unlink(aliceToken, masterId, connectionId).andExpect(status().isForbidden()); // developer of the master
        unlink(bobToken, masterId, connectionId).andExpect(status().isForbidden());   // PM of a module, not of the master
        unlink(readerToken, masterId, connectionId).andExpect(status().isForbidden()); // Git Integration reader
        unlink(otherTenantToken, masterId, connectionId).andExpect(status().isNotFound());

        GitRepository row = connections.findById(connectionId).orElseThrow();
        assertThat(row.getStatus()).isEqualTo(GitRepositoryStatus.ACTIVE);
        assertThat(row.getVersion()).isEqualTo(version);
        // A Git Integration manager may.
        unlink(managerToken, masterId, connectionId).andExpect(status().isOk());
    }

    @Test
    void onlyARepositoryOfTheProjectCanBeUnlinked() throws Exception {
        Long foreign = connections.saveAndFlush(connection(9303L, "banking", GitRepositoryStatus.ACTIVE, otherProjectId)).getId();

        unlink(pamToken, masterId, 999_999L).andExpect(status().isNotFound());
        unlink(pamToken, masterId, foreign).andExpect(status().isNotFound());
        assertThat(connections.findById(foreign).orElseThrow().getStatus()).isEqualTo(GitRepositoryStatus.ACTIVE);
        unlink(pamToken, masterId, null).andExpect(status().isBadRequest());
    }

    // ---- AC04 · GitHub revokes the access --------------------------------------------------------------

    @Test
    void ac04ARepositoryRemovedFromTheAppIsDisconnectedAndThePmIsWarned() throws Exception {
        deliverAndProcess("installation_repositories", repositoriesEvent("removed", "repositories_removed", REPO));

        GitRepository row = connections.findById(connectionId).orElseThrow();
        assertThat(row.getStatus()).isEqualTo(GitRepositoryStatus.DISCONNECTED);
        assertThat(row.getStatusReason()).isEqualTo("REPOSITORY_ACCESS_REMOVED");
        assertThat(row.getStatusChangedAt()).isNotNull();
        view(pamToken, masterId)
                .andExpect(jsonPath("$.repository.status").value("DISCONNECTED"))
                .andExpect(jsonPath("$.repository.statusReason").value("REPOSITORY_ACCESS_REMOVED"))
                .andExpect(jsonPath("$.canResync").value(true))
                .andExpect(jsonPath("$.canUnlink").value(true))
                .andExpect(jsonPath("$.canLink").value(false))
                .andExpect(jsonPath("$.canSync").value(false));
        assertThat(notifications.findTop30ByUser_IdOrderByCreatedAtDesc(pam.getId()))
                .singleElement().satisfies((Notification notification) -> {
                    assertThat(notification.getTitle()).isEqualTo("Repository needs attention");
                    assertThat(notification.getMessage()).contains("hcm26-java-team/webshop").contains("grant");
                });
        // Changing repositories is "unlink, then link".
        assertThat(connections.findCurrent(masterId)).map(GitRepository::getId).contains(connectionId);
        // A disconnected repository no longer holds the GitHub repository itself.
        assertThat(connections.findReceiving(GitProvider.GITHUB, REPO)).isEmpty();
    }

    @Test
    void ac04AccessGrantedBackOnGitHubReconnectsTheRepositoryAndSyncsTheGap() throws Exception {
        deliverAndProcess("installation_repositories", repositoriesEvent("removed", "repositories_removed", REPO));
        deliverAndProcess("installation_repositories", repositoriesEvent("added", "repositories_added", REPO));

        GitRepository row = connections.findById(connectionId).orElseThrow();
        assertThat(row.getStatus()).isEqualTo(GitRepositoryStatus.ACTIVE);
        assertThat(row.getStatusReason()).isNull();
        assertThat(jobs.findFirstByRepository_IdOrderByIdDesc(connectionId)).get()
                .satisfies(job -> assertThat(job.getType()).isEqualTo(GitSyncJobType.WEBHOOK));
        assertThat(notifications.findTop30ByUser_IdOrderByCreatedAtDesc(pam.getId()))
                .extracting(Notification::getTitle)
                .containsExactlyInAnyOrder("Repository needs attention", "Repository connection restored");
    }

    @Test
    void syncAgainChecksGitHubBeforeRestoringADisconnectedRepository() throws Exception {
        tx.executeWithoutResult(status -> connections.findById(connectionId).orElseThrow().setStatus(GitRepositoryStatus.DISCONNECTED));
        when(github.getRepository(anyString(), eq(REPO))).thenReturn(Optional.empty());

        sync(aliceToken, masterId).andExpect(status().isForbidden()); // restoring changes the configuration
        sync(pamToken, masterId)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("GIT_REPOSITORY_NOT_ACCESSIBLE"));
        assertThat(connections.findById(connectionId).orElseThrow().getStatus()).isEqualTo(GitRepositoryStatus.DISCONNECTED);

        sync(pamToken, masterId).andExpect(status().isTooManyRequests()); // one GitHub check every few seconds
    }

    @Test
    void syncAgainRestoresARepositoryGitHubCanReadAgain() throws Exception {
        tx.executeWithoutResult(status -> connections.findById(connectionId).orElseThrow().setStatus(GitRepositoryStatus.ERROR));
        when(github.getRepository(anyString(), eq(REPO))).thenReturn(Optional.of(repo(REPO, "webshop")));

        sync(pamToken, masterId)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.type").value("MANUAL"));
        assertThat(connections.findById(connectionId).orElseThrow().getStatus()).isEqualTo(GitRepositoryStatus.ACTIVE);
    }

    // ---- Rename / transfer -------------------------------------------------------------------------

    @Test
    void aRenamedRepositoryKeepsItsNameCurrentExceptOnceUnlinked() throws Exception {
        tx.executeWithoutResult(status -> connections.findById(connectionId).orElseThrow().setStatus(GitRepositoryStatus.DISCONNECTED));
        deliverAndProcess("repository", renamed("hcm26-java-team/webshop-v2"));
        GitRepository row = connections.findById(connectionId).orElseThrow();
        assertThat(row.getFullName()).isEqualTo("hcm26-java-team/webshop-v2");
        assertThat(row.getHtmlUrl()).isEqualTo("https://github.com/hcm26-java-team/webshop-v2");

        tx.executeWithoutResult(status -> connections.findById(connectionId).orElseThrow().setStatus(GitRepositoryStatus.INACTIVE));
        deliverAndProcess("repository", renamed("hcm26-java-team/webshop-v3"));
        assertThat(connections.findById(connectionId).orElseThrow().getFullName()).isEqualTo("hcm26-java-team/webshop-v2");
    }

    // ---- Change repository: unlink, then link ------------------------------------------------------------

    @Test
    void linkingAgainTheRepositoryThatWasUnlinkedReactivatesItWithoutDuplicatingItsData() throws Exception {
        storeCommit(connectionId, "c".repeat(40));
        when(github.getRepository(anyString(), eq(REPO))).thenReturn(Optional.of(repo(REPO, "webshop")));
        unlink(pamToken, masterId, connectionId).andExpect(status().isOk());

        link(pamToken, masterId, REPO)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.repository.id").value(connectionId))
                .andExpect(jsonPath("$.repository.status").value("ACTIVE"))
                .andExpect(jsonPath("$.previousRepositories", hasSize(0)));
        assertThat(connections.findAll()).hasSize(1);
        GitRepository row = connections.findById(connectionId).orElseThrow();
        assertThat(row.getUnlinkedAt()).isNull();
        assertThat(row.getLinkedByUserId()).isEqualTo(pam.getId());
        assertThat(jobs.findFirstByRepository_IdOrderByIdDesc(connectionId)).get()
                .satisfies(job -> assertThat(job.getType()).isEqualTo(GitSyncJobType.MANUAL));
        assertThat(commits.countByRepository_Id(connectionId)).isEqualTo(1);
    }

    @Test
    void analyticsCoverEveryRepositoryOfTheProjectWithItsLabel() throws Exception {
        storeCommit(connectionId, "d".repeat(40));
        unlink(pamToken, masterId, connectionId).andExpect(status().isOk());
        Long second = connections.saveAndFlush(connection(OTHER_REPO, "inventory", GitRepositoryStatus.ACTIVE)).getId();
        storeCommit(second, "e".repeat(40));

        mvc.perform(get(url(masterId) + "/commits").header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[?(@.repository.fullName == 'hcm26-java-team/webshop')].repository.status").value("INACTIVE"))
                .andExpect(jsonPath("$.items[?(@.repository.fullName == 'hcm26-java-team/inventory')].repository.status").value("ACTIVE"));
        mvc.perform(get(url(masterId) + "/commits").param("repositoryId", String.valueOf(connectionId))
                        .header("Authorization", "Bearer " + aliceToken))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].repository.id").value(connectionId));
        mvc.perform(get(url(masterId) + "/activity").header("Authorization", "Bearer " + aliceToken))
                .andExpect(jsonPath("$.repositoryId").value(second))
                .andExpect(jsonPath("$.commitCount").value(2))
                .andExpect(jsonPath("$.repositories", hasSize(2)));
        mvc.perform(get(url(masterId) + "/insights").param("range", "30d").header("Authorization", "Bearer " + aliceToken))
                .andExpect(jsonPath("$.summary.commits").value(2));
        // A repository of another project cannot be read through this one.
        Long foreign = connections.saveAndFlush(connection(9303L, "banking", GitRepositoryStatus.ACTIVE, otherProjectId)).getId();
        mvc.perform(get(url(masterId) + "/commits").param("repositoryId", String.valueOf(foreign))
                        .header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isNotFound());
    }

    // ---- AC05 · Module -----------------------------------------------------------------------------

    @Test
    void ac05AModuleShowsTheMasterRepositoryReadOnly() throws Exception {
        view(managerToken, moduleId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inherited").value(true))
                .andExpect(jsonPath("$.repository.fullName").value("hcm26-java-team/webshop"))
                .andExpect(jsonPath("$.canLink").value(false))
                .andExpect(jsonPath("$.canSync").value(false))
                .andExpect(jsonPath("$.canResync").value(false))
                .andExpect(jsonPath("$.canUnlink").value(false));

        unlink(managerToken, moduleId, connectionId)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("GIT_PROJECT_NOT_MASTER"));
        sync(managerToken, moduleId)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("GIT_PROJECT_NOT_MASTER"));
        assertThat(connections.findById(connectionId).orElseThrow().getStatus()).isEqualTo(GitRepositoryStatus.ACTIVE);
    }

    // ---- helpers -----------------------------------------------------------------------------------

    private static String url(Long projectId) {
        return "/api/v1/git-integration/projects/" + projectId + "/repository";
    }

    private ResultActions view(String token, Long projectId) throws Exception {
        return mvc.perform(get(url(projectId)).header("Authorization", "Bearer " + token));
    }

    private ResultActions unlink(String token, Long projectId, Long repositoryId) throws Exception {
        return mvc.perform(post(url(projectId) + "/unlink").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"repositoryId\": " + repositoryId + "}"));
    }

    private ResultActions sync(String token, Long projectId) throws Exception {
        return mvc.perform(post(url(projectId) + "/sync").header("Authorization", "Bearer " + token));
    }

    private ResultActions link(String token, Long projectId, long externalId) throws Exception {
        return mvc.perform(post(url(projectId)).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"installationId\": " + installationRowId + ", \"externalId\": " + externalId + "}"));
    }

    private ObjectNode repositoriesEvent(String action, String field, long repositoryId) {
        ObjectNode body = base();
        body.remove("repository");
        body.put("action", action);
        body.put("repository_selection", "selected");
        body.putArray("repositories_added");
        body.putArray("repositories_removed");
        body.putArray(field).addObject().put("id", repositoryId).put("full_name", "hcm26-java-team/webshop");
        return body;
    }

    private ObjectNode renamed(String fullName) {
        ObjectNode body = base();
        body.put("action", "renamed");
        ObjectNode repository = (ObjectNode) body.get("repository");
        repository.put("full_name", fullName);
        repository.put("name", fullName.substring(fullName.indexOf('/') + 1));
        repository.put("html_url", "https://github.com/" + fullName);
        return body;
    }

    private GitRepository connection(long externalId, String name, GitRepositoryStatus status) {
        return connection(externalId, name, status, masterId);
    }

    private GitRepository connection(long externalId, String name, GitRepositoryStatus status, Long projectId) {
        return GitRepository.builder()
                .tenant(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.tenant.Tenant.class, tenantId)).project(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.domain.Project.class, projectId)).installation(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitInstallation.class, installationRowId))
                .provider(GitProvider.GITHUB).externalId(externalId).ownerLogin("hcm26-java-team").name(name)
                .fullName("hcm26-java-team/" + name).htmlUrl("https://github.com/hcm26-java-team/" + name)
                .visibility("private").defaultBranch("main").status(status)
                .linkedByUser(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.rbac.user.User.class, 1L)).linkedAt(LocalDateTime.now()).build();
    }

    private void storeCommit(Long repositoryId, String sha) {
        long externalId = connections.findById(repositoryId).orElseThrow().getExternalId();
        commits.saveAndFlush(GitCommit.builder().tenant(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.tenant.Tenant.class, tenantId)).project(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.domain.Project.class, masterId)).repository(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitRepository.class, repositoryId))
                .repoExternalId(externalId).sha(sha).message("Work " + sha.charAt(0)).committedAt(LocalDateTime.now().minusHours(1))
                .firstSeenRef("refs/heads/main").source(GitCommitSource.WEBHOOK_PAYLOAD).ingestedEvent(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitWebhookEvent.class, 1L))
                .ingestedAt(LocalDateTime.now()).bot(false).build());
    }

    private Long queueJob() {
        return jobs.saveAndFlush(GitSyncJob.builder().tenant(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.tenant.Tenant.class, tenantId)).repository(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitRepository.class, connectionId)).type(GitSyncJobType.MANUAL)
                .status(GitSyncJobStatus.PENDING).maxAttempts(3).nextRunAt(LocalDateTime.now().plusMinutes(10)).build()).getId();
    }

    private static GitHubRepository repo(long id, String name) {
        return new GitHubRepository(id, name, "hcm26-java-team/" + name, new GitHubRepository.Owner("hcm26-java-team"),
                "https://github.com/hcm26-java-team/" + name, true, "private", "main", false, false);
    }

    private ProjectTeam team(String name, TrainingClass trainingClass, TeamAllocationSession session, Project project) {
        ProjectTeam team = new ProjectTeam();
        team.setTeamName(name);
        team.setTrainingClass(trainingClass);
        team.setAllocationSession(session);
        team.setMaxMembers(6);
        team.setStatus(ProjectTeamStatus.ACTIVE);
        team.setProject(project);
        return teams.saveAndFlush(team);
    }

    private User person(Tenant tenant, String first) {
        User user = user(tenant, role("GI5-", "SPRINT_BACKLOG_READ"));
        user.setFirstName(first);
        user.setLastName("Tester");
        return users.saveAndFlush(user);
    }

    private void join(ProjectTeam team, TrainingClass trainingClass, User user, String role) {
        ClassMember classMember = new ClassMember();
        classMember.setTrainingClass(trainingClass);
        classMember.setUser(user);
        classMember.setStatus(ClassMemberStatus.ACTIVE);
        classMembers.saveAndFlush(classMember);
        ProjectMember membership = new ProjectMember();
        membership.setTeam(team);
        membership.setClassMember(classMember);
        membership.setRole(role);
        memberships.saveAndFlush(membership);
    }
}
