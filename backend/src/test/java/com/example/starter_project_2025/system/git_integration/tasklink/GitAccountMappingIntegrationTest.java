package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.git_integration.domain.GitCommit;
import com.example.starter_project_2025.system.git_integration.domain.GitCommitSource;
import com.example.starter_project_2025.system.git_integration.domain.GitContributor;
import com.example.starter_project_2025.system.git_integration.domain.GitContributorMapSource;
import com.example.starter_project_2025.system.git_integration.domain.GitIdentitySource;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.UserGitIdentity;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubUser;
import com.example.starter_project_2025.system.git_integration.repository.GitContributorRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitOAuthStateRepository;
import com.example.starter_project_2025.system.git_integration.repository.UserGitIdentityRepository;
import com.example.starter_project_2025.system.git_integration.service.GitHubOAuthStateService;
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
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * GI-06: Connect GitHub account & map to project member. Teams: one on the master project
 * (Alice DEV, Pam PM), one on the module (Bob DEV), plus Dave (DEV, master) for conflicts and
 * Carol who belongs to no team. GitHub is mocked; everything else is real.
 */
class GitAccountMappingIntegrationTest extends AbstractTaskLinkIntegrationTest {

    private static final String API = "/api/v1/git-integration";
    private static final AtomicLong IDS = new AtomicLong(50_000);

    @Autowired com.example.starter_project_2025.system.notification.NotificationRepository notifications;
    @Autowired GitContributorRepository contributors;
    @Autowired UserGitIdentityRepository identities;
    @Autowired GitOAuthStateRepository states;
    @Autowired GitHubOAuthStateService stateService;
    @Autowired TrainingClassRepository classes;
    @Autowired TeamAllocationSessionRepository allocationSessions;
    @Autowired ClassMemberRepository classMembers;
    @Autowired ProjectTeamRepository teams;
    @Autowired ProjectMemberRepository memberships;

    User alice;
    User bob;
    User pam;
    User dave;
    User carol;
    String aliceToken;
    String bobToken;
    String pamToken;
    String daveToken;
    String carolToken;

    @BeforeEach
    void members() {
        contributors.deleteAll();
        identities.deleteAll();
        states.deleteAll();
        tx.executeWithoutResult(status -> {
            Tenant tenant = tenants.findById(tenantId).orElseThrow();
            Project master = projects.findById(masterId).orElseThrow();
            Project module = projects.findById(moduleId).orElseThrow();
            TrainingClass trainingClass = new TrainingClass();
            trainingClass.setCode("GI6-" + UUID.randomUUID());
            trainingClass.setName("GI-06 class");
            trainingClass.setTenantId(tenantId);
            trainingClass.setProgramId(1L);
            trainingClass.setStatus(TrainingClassStatus.ONGOING);
            classes.saveAndFlush(trainingClass);
            TeamAllocationSession session = new TeamAllocationSession();
            session.setTrainingClass(trainingClass);
            session.setMaxMembers(6);
            session.setStatus(TeamAllocationSessionStatus.PUBLISHED);
            allocationSessions.saveAndFlush(session);
            ProjectTeam masterTeam = team("Shop team", trainingClass, session, master);
            ProjectTeam moduleTeam = team("Cart team", trainingClass, session, module);

            alice = person(tenant, "Alice", "Nguyen");
            bob = person(tenant, "Bob", "Tran");
            pam = person(tenant, "Pam", "Le");
            dave = person(tenant, "Dave", "Pham");
            carol = person(tenant, "Carol", "Vo");
            join(masterTeam, trainingClass, alice, "DEV");
            join(masterTeam, trainingClass, pam, "PM");
            join(masterTeam, trainingClass, dave, "DEV");
            join(moduleTeam, trainingClass, bob, "DEV");
            aliceToken = token(alice);
            bobToken = token(bob);
            pamToken = token(pam);
            daveToken = token(dave);
            carolToken = token(carol);
        });
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

    private User person(Tenant tenant, String first, String last) {
        User user = user(tenant, role("GI6-", "SPRINT_BACKLOG_READ"));
        user.setFirstName(first);
        user.setLastName(last);
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

    // ---- calls ------------------------------------------------------------------------------------

    private ResultActions connect(String token, Long projectId) throws Exception {
        return mvc.perform(post(API + "/projects/{id}/github-account/connect", projectId).header("Authorization", "Bearer " + token));
    }

    private ResultActions callback(String token, Map<String, String> body) throws Exception {
        return mvc.perform(post(API + "/github/account-callback").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }

    private ResultActions overview(String token, Long projectId) throws Exception {
        return mvc.perform(get(API + "/projects/{id}/github-accounts", projectId).header("Authorization", "Bearer " + token));
    }

    /** Connect → GitHub authorization URL; returns the state GitHub would send back. */
    private String startAuthorization(String token, Long projectId) throws Exception {
        String body = connect(token, projectId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("AUTHORIZE_REQUIRED"))
                .andReturn().getResponse().getContentAsString();
        String url = json.readTree(body).get("authorizeUrl").asText();
        return UriComponentsBuilder.fromUriString(url).build().getQueryParams().getFirst("state");
    }

    private void gitHubReturns(String code, long id, String login) {
        when(github.exchangeCodeForUserToken(code)).thenReturn("token-" + code);
        when(github.getAuthenticatedUser("token-" + code)).thenReturn(new GitHubUser(id, login, "https://avatars/" + id));
    }

    private UserGitIdentity identity(User user, long githubId, String login) {
        return identities.saveAndFlush(UserGitIdentity.builder().tenant(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.tenant.Tenant.class, tenantId)).user(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.rbac.user.User.class, user.getId()))
                .provider(GitProvider.GITHUB).externalUserId(githubId).login(login).source(GitIdentitySource.OAUTH)
                .verifiedAt(LocalDateTime.now()).build());
    }

    private GitContributor contributor(String key) {
        return contributors.findByMasterProject_IdAndIdentityKey(masterId, key).orElseThrow();
    }

    private void storeCommit(Long githubId, String login, String email, String name) {
        long id = IDS.incrementAndGet();
        LocalDateTime at = LocalDateTime.now().minusHours(1);
        commits.saveAndFlush(GitCommit.builder()
                .tenant(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.tenant.Tenant.class, tenantId)).project(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.domain.Project.class, masterId)).repository(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitRepository.class, connectionId)).repoExternalId(REPO)
                .sha("gi6-" + id).message("commit " + id).authorGithubId(githubId).authorLogin(login)
                .authorEmail(email).authorName(name).committedAt(at).firstSeenRef("refs/heads/main")
                .source(GitCommitSource.WEBHOOK_PAYLOAD).ingestedEvent(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.git_integration.domain.GitWebhookEvent.class, 1L)).ingestedAt(at).parentCount(1).build());
    }

    // ---- AC02 + AC07 --------------------------------------------------------------------------------

    @Test
    void aModuleMemberAuthorizesGitHubAndTheMappingIsStoredAtTheMaster() throws Exception {
        String state = startAuthorization(bobToken, moduleId);
        String url = json.readTree(connect(bobToken, moduleId).andReturn().getResponse().getContentAsString())
                .get("authorizeUrl").asText();
        assertThat(url).startsWith("https://github.com/login/oauth/authorize?").contains("client_id=Iv1.test")
                .contains("redirect_uri=").doesNotContain("scope=");

        gitHubReturns("code-bob", 501L, "bob-gh");
        callback(bobToken, Map.of("state", state, "code", "code-bob"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("CONNECTED"))
                .andExpect(jsonPath("$.account.login").value("bob-gh"))
                .andExpect(jsonPath("$.account.githubUserId").value(501))
                .andExpect(jsonPath("$.master.id").value(masterId))
                .andExpect(jsonPath("$.authorizeUrl").doesNotExist());

        GitContributor mapped = contributor("gh:501");
        assertThat(mapped.getUserId()).isEqualTo(bob.getId());
        assertThat(mapped.getMapSource()).isEqualTo(GitContributorMapSource.OAUTH);
        assertThat(identities.findByUser_IdAndProvider(bob.getId(), GitProvider.GITHUB)).get()
                .extracting(UserGitIdentity::getExternalUserId).isEqualTo(501L);
        // The state is single use.
        callback(bobToken, Map.of("state", state, "code", "code-bob"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GIT_STATE_INVALID"));
    }

    // ---- AC01 ----------------------------------------------------------------------------------------

    @Test
    void aVerifiedIdentityIsReusedWithoutRedirectAndConnectIsIdempotent() throws Exception {
        identity(alice, 601L, "alice-gh");
        long statesBefore = states.count();
        connect(aliceToken, masterId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("CONNECTED"))
                .andExpect(jsonPath("$.account.login").value("alice-gh"))
                .andExpect(jsonPath("$.authorizeUrl").doesNotExist());
        connect(aliceToken, moduleId).andExpect(jsonPath("$.outcome").value("CONNECTED"));
        assertThat(states.count()).isEqualTo(statesBefore);
        assertThat(contributor("gh:601").getUserId()).isEqualTo(alice.getId());
        assertThat(contributor("gh:601").getMapSource()).isEqualTo(GitContributorMapSource.IDENTITY);
    }

    @Test
    void theGitHubAccountOfAnAppInstallationTheUserConnectedIsReused() throws Exception {
        installations.saveAndFlush(GitInstallation.builder()
                .tenant(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.tenant.Tenant.class, tenantId)).provider(GitProvider.GITHUB).installationId(998877L)
                .accountId(2L).accountLogin("pam-org").accountType("Organization").repositorySelection("all")
                .status(GitInstallationStatus.CONNECTED).connectedByUser(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.rbac.user.User.class, pam.getId()))
                .githubUserId(701L).githubUserLogin("pam-gh")
                .connectedAt(LocalDateTime.now()).lastVerifiedAt(LocalDateTime.now()).build());
        overview(pamToken, masterId).andExpect(jsonPath("$.viewer.identity.login").value("pam-gh"));
        connect(pamToken, masterId)
                .andExpect(jsonPath("$.outcome").value("CONNECTED"))
                .andExpect(jsonPath("$.account.login").value("pam-gh"));
        assertThat(identities.findByUser_IdAndProvider(pam.getId(), GitProvider.GITHUB)).get()
                .extracting(UserGitIdentity::getSource).isEqualTo(GitIdentitySource.INSTALLATION);
    }

    // ---- AC03 ----------------------------------------------------------------------------------------

    @Test
    void aDeniedOrInvalidAuthorizationChangesNothing() throws Exception {
        String state = startAuthorization(aliceToken, masterId);
        callback(aliceToken, Map.of("state", state, "error", "access_denied"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GIT_AUTHORIZATION_DENIED"));
        callback(aliceToken, Map.of("state", "not-a-state", "code", "x"))
                .andExpect(jsonPath("$.code").value("GIT_STATE_INVALID"));
        // Another user's state cannot be used (nor burnt).
        String bobState = startAuthorization(bobToken, moduleId);
        callback(aliceToken, Map.of("state", bobState, "code", "x")).andExpect(jsonPath("$.code").value("GIT_STATE_INVALID"));
        // A state of the App installation flow is not accepted here.
        String installState = stateService.issue(alice.getId(), tenantId).rawState();
        callback(aliceToken, Map.of("state", installState, "code", "x")).andExpect(jsonPath("$.code").value("GIT_STATE_INVALID"));

        assertThat(contributors.count()).isZero();
        assertThat(identities.count()).isZero();
    }

    // ---- AC04 ----------------------------------------------------------------------------------------

    @Test
    void aGitHubAccountLinkedToAnotherUserIsRefused() throws Exception {
        identity(dave, 801L, "dave-gh");
        connect(daveToken, masterId).andExpect(jsonPath("$.outcome").value("CONNECTED"));
        String state = startAuthorization(bobToken, moduleId);
        gitHubReturns("code-steal", 801L, "dave-gh");
        callback(bobToken, Map.of("state", state, "code", "code-steal"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GIT_IDENTITY_LINKED_ELSEWHERE"));
        assertThat(contributor("gh:801").getUserId()).isEqualTo(dave.getId());
        assertThat(identities.findByUser_IdAndProvider(bob.getId(), GitProvider.GITHUB)).isEmpty();
        assertThat(identities.findByProviderAndExternalUserId(GitProvider.GITHUB, 801L)).get()
                .extracting(UserGitIdentity::getUserId).isEqualTo(dave.getId());
    }

    // ---- AC05 ----------------------------------------------------------------------------------------

    @Test
    void anAccountMappedToAnotherMemberOfTheMasterIsRefusedAndKept() throws Exception {
        contributors.saveAndFlush(GitContributor.builder().tenant(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.tenant.Tenant.class, tenantId)).masterProject(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.project.domain.Project.class, masterId))
                .identityKey("gh:901").externalUserId(901L).login("shared-gh").user(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.rbac.user.User.class, dave.getId()))
                .mapSource(GitContributorMapSource.OAUTH).mappedByUser(com.example.starter_project_2025.system.git_integration.GitTestReferences.ref(com.example.starter_project_2025.system.rbac.user.User.class, dave.getId())).mappedAt(LocalDateTime.now()).build());
        String state = startAuthorization(aliceToken, masterId);
        gitHubReturns("code-shared", 901L, "shared-gh");
        callback(aliceToken, Map.of("state", state, "code", "code-shared"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GIT_ACCOUNT_MAPPED_TO_OTHER_MEMBER"));
        assertThat(contributor("gh:901").getUserId()).isEqualTo(dave.getId());
        // The whole attempt rolled back: no identity was kept for Alice either.
        assertThat(identities.findByUser_IdAndProvider(alice.getId(), GitProvider.GITHUB)).isEmpty();
    }

    // ---- AC06 ----------------------------------------------------------------------------------------

    @Test
    void someoneOutsideTheMasterAndItsModulesCannotConnect() throws Exception {
        connect(carolToken, masterId)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("GIT_NOT_PROJECT_MEMBER"));
        connect(carolToken, moduleId).andExpect(jsonPath("$.code").value("GIT_NOT_PROJECT_MEMBER"));
        connect(otherTenantToken, masterId).andExpect(status().isNotFound());
    }

    // ---- AC08 ----------------------------------------------------------------------------------------

    @Test
    void aRenamedGitHubAccountKeepsItsMappingAndShowsTheNewLogin() throws Exception {
        String state = startAuthorization(aliceToken, masterId);
        gitHubReturns("code-old", 1001L, "alice-old");
        callback(aliceToken, Map.of("state", state, "code", "code-old")).andExpect(status().isOk());

        // The identity exists now: connecting from the module is one click, the mapping is unchanged.
        connect(aliceToken, moduleId).andExpect(jsonPath("$.outcome").value("CONNECTED"));
        assertThat(contributor("gh:1001").getUserId()).isEqualTo(alice.getId());

        // Re-authorizing refreshes the identity's login.
        identities.deleteAll();
        String again = startAuthorization(aliceToken, masterId);
        gitHubReturns("code-new", 1001L, "alice-new");
        callback(aliceToken, Map.of("state", again, "code", "code-new"))
                .andExpect(jsonPath("$.account.login").value("alice-new"));
        assertThat(contributor("gh:1001").getLogin()).isEqualTo("alice-new");
        assertThat(contributor("gh:1001").getUserId()).isEqualTo(alice.getId());
    }

    // ---- AC09 + overview -----------------------------------------------------------------------------

    @Test
    void mappedActivityCountsForTheMemberWithoutRewritingGitData() throws Exception {
        storeCommit(1101L, "alice-gh", "alice@company.vn", "Alice Nguyen");
        storeCommit(null, "alice-gh", "alice@company.vn", "Alice Nguyen"); // push payload: login, no id
        storeCommit(null, null, "alice.home@gmail.com", "Alice Nguyen");   // e-mail only
        storeCommit(null, null, "unknown@x.test", "Stranger");

        overview(pamToken, masterId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewer.canManage").value(true))
                .andExpect(jsonPath("$.summary.members").value(4))
                .andExpect(jsonPath("$.summary.connected").value(0))
                .andExpect(jsonPath("$.unmapped", hasSize(3)));

        identity(alice, 1101L, "alice-gh");
        connect(aliceToken, masterId).andExpect(jsonPath("$.outcome").value("CONNECTED"));

        JsonNode body = json.readTree(overview(pamToken, masterId).andReturn().getResponse().getContentAsString());
        JsonNode aliceRow = find(body.get("members"), "userId", alice.getId());
        assertThat(aliceRow.get("github").get("login").asText()).isEqualTo("alice-gh");
        assertThat(aliceRow.get("activity").get("commits").asLong()).isEqualTo(2); // id + login of the push payload
        JsonNode homeEmail = find(body.get("unmapped"), "email", "alice.home@gmail.com");
        assertThat(homeEmail.get("kind").asText()).isEqualTo("EMAIL");
        assertThat(homeEmail.get("suggestedUserId").asLong()).isEqualTo(alice.getId()); // same name, only a suggestion
        assertThat(contributors.findByMasterProject_IdAndIdentityKey(masterId, "email:alice.home@gmail.com").orElseThrow()
                .getUserId()).isNull();

        // Insights show the member, Git rows untouched.
        mvc.perform(get(API + "/projects/{id}/repository/insights", masterId).param("range", "7d")
                        .header("Authorization", "Bearer " + pamToken))
                .andExpect(jsonPath("$.contributors[0].mapped").value(true))
                .andExpect(jsonPath("$.contributors[0].memberName").value("Alice Nguyen"))
                .andExpect(jsonPath("$.contributors[0].commits").value(2));
        assertThat(commits.findAll()).allMatch(commit -> commit.getSha().startsWith("gi6-"));
    }

    // ---- AC10 ----------------------------------------------------------------------------------------

    @Test
    void thePmUnlinksAMemberAndTheActivityBecomesUnmappedAgain() throws Exception {
        storeCommit(1201L, "dave-gh", "dave@x.test", "Dave");
        identity(dave, 1201L, "dave-gh");
        connect(daveToken, masterId).andExpect(jsonPath("$.outcome").value("CONNECTED"));

        mvc.perform(delete(API + "/projects/{id}/github-accounts/{userId}", masterId, dave.getId())
                .header("Authorization", "Bearer " + aliceToken)).andExpect(status().isForbidden());
        mvc.perform(delete(API + "/projects/{id}/github-accounts/{userId}", moduleId, dave.getId())
                .header("Authorization", "Bearer " + pamToken)).andExpect(status().isNoContent());
        mvc.perform(delete(API + "/projects/{id}/github-accounts/{userId}", masterId, dave.getId())
                .header("Authorization", "Bearer " + pamToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GIT_ACCOUNT_MAPPING_NOT_FOUND"));

        assertThat(contributor("gh:1201").getUserId()).isNull();
        assertThat(commits.count()).isEqualTo(1);
        overview(pamToken, masterId).andExpect(jsonPath("$.unmapped[0].login").value("dave-gh"));
        // The identity stays: Dave reconnects in one click.
        connect(daveToken, masterId).andExpect(jsonPath("$.outcome").value("CONNECTED"));
    }

    @Test
    void anAccountUnlinkedEverywhereCanBeConnectedByWhoeverProvesItOnGitHub() throws Exception {
        identity(dave, 1301L, "shared-gh");
        connect(daveToken, masterId).andExpect(jsonPath("$.outcome").value("CONNECTED"));
        mvc.perform(delete(API + "/projects/{id}/github-accounts/{userId}", masterId, dave.getId())
                .header("Authorization", "Bearer " + pamToken)).andExpect(status().isNoContent());

        // Reusing the kept identity needs no GitHub round trip, so it does not take the account over.
        String state = startAuthorization(bobToken, moduleId);
        gitHubReturns("code-take", 1301L, "shared-gh");
        callback(bobToken, Map.of("state", state, "code", "code-take"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("CONNECTED"))
                .andExpect(jsonPath("$.account.login").value("shared-gh"));

        assertThat(contributor("gh:1301").getUserId()).isEqualTo(bob.getId());
        assertThat(identities.findByProviderAndExternalUserId(GitProvider.GITHUB, 1301L)).get()
                .extracting(UserGitIdentity::getUserId).isEqualTo(bob.getId());
        assertThat(identities.findByUser_IdAndProvider(dave.getId(), GitProvider.GITHUB)).isEmpty();
        // Dave lost the one-click reconnect: the account is Bob's now.
        overview(daveToken, masterId).andExpect(jsonPath("$.viewer.identity").doesNotExist());
    }

    // ---- SY-01 Q2: who may "Sync now" ----------------------------------------------------------------

    @Test
    void aPmOfTheMasterMaySyncTheRepositoryButAMemberMayNot() throws Exception {
        String url = "/api/v1/git-integration/projects/" + masterId + "/repository";
        mvc.perform(get(url).header("Authorization", "Bearer " + pamToken)).andExpect(jsonPath("$.canSync").value(true));
        mvc.perform(get(url).header("Authorization", "Bearer " + aliceToken)).andExpect(jsonPath("$.canSync").value(false));

        mvc.perform(post(url + "/sync").header("Authorization", "Bearer " + aliceToken)).andExpect(status().isForbidden());
        mvc.perform(post(url + "/sync").header("Authorization", "Bearer " + pamToken))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.type").value("MANUAL"));
    }

    // ---- GI-02: the PM acts on the connection and is told when it breaks ------------------------------

    @Test
    void thePmMayCheckTheConnectionAgainAndIsToldWhenItBreaks() throws Exception {
        String url = "/api/v1/git-integration/projects/" + masterId + "/github/connection";
        mvc.perform(get(url).header("Authorization", "Bearer " + aliceToken))
                .andExpect(jsonPath("$.status").value("CONNECTED"))
                .andExpect(jsonPath("$.actions.canRecheck").value(false));
        mvc.perform(post(url + "/recheck").header("Authorization", "Bearer " + aliceToken)).andExpect(status().isForbidden());

        when(github.getInstallation(GITHUB_INSTALLATION_ID)).thenReturn(java.util.Optional.of(
                new com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallation(GITHUB_INSTALLATION_ID,
                        new com.example.starter_project_2025.system.git_integration.github.dto.GitHubAccount(1L, "hcm26-java-team", "Organization"),
                        123L, "selected", "2026-11-21T10:00:00Z")));
        mvc.perform(post(url + "/recheck").header("Authorization", "Bearer " + pamToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connection.status").value("SUSPENDED"));

        assertThat(notifications.findTop30ByUser_IdOrderByCreatedAtDesc(pam.getId()))
                .extracting(com.example.starter_project_2025.system.notification.Notification::getTitle)
                .containsExactly("GitHub connection needs attention");
        assertThat(notifications.findTop30ByUser_IdOrderByCreatedAtDesc(alice.getId())).isEmpty(); // not a PM
    }

    // ---- AC11 ----------------------------------------------------------------------------------------

    @Test
    void thePmAssignsAnEmailOnlyContributorWithoutMergingOtherEmails() throws Exception {
        storeCommit(null, null, "bob@home.test", "Bob");
        storeCommit(null, null, "bob@work.test", "Bob");
        storeCommit(1301L, "someone-gh", null, "Someone");
        overview(pamToken, masterId).andExpect(status().isOk());
        Long home = contributor("email:bob@home.test").getId();
        Long gitHub = contributor("gh:1301").getId();
        String assign = API + "/projects/{id}/contributors/{cid}/assign";

        mvc.perform(post(assign, masterId, home).header("Authorization", "Bearer " + aliceToken)
                .contentType(MediaType.APPLICATION_JSON).content("{\"userId\":" + bob.getId() + "}"))
                .andExpect(status().isForbidden());
        mvc.perform(post(assign, masterId, home).header("Authorization", "Bearer " + pamToken)
                .contentType(MediaType.APPLICATION_JSON).content("{\"userId\":" + carol.getId() + "}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("GIT_ASSIGNEE_NOT_MEMBER"));
        mvc.perform(post(assign, masterId, gitHub).header("Authorization", "Bearer " + pamToken)
                .contentType(MediaType.APPLICATION_JSON).content("{\"userId\":" + bob.getId() + "}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("GIT_CONTRIBUTOR_HAS_GITHUB_ID"));
        mvc.perform(post(assign, moduleId, home).header("Authorization", "Bearer " + pamToken)
                .contentType(MediaType.APPLICATION_JSON).content("{\"userId\":" + bob.getId() + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(bob.getId()))
                .andExpect(jsonPath("$.source").value("MANUAL"));

        assertThat(contributor("email:bob@home.test").getUserId()).isEqualTo(bob.getId());
        assertThat(contributor("email:bob@work.test").getUserId()).isNull();
        JsonNode body = json.readTree(overview(pamToken, masterId).andReturn().getResponse().getContentAsString());
        JsonNode bobRow = find(body.get("members"), "userId", bob.getId());
        assertThat(bobRow.get("emails")).hasSize(1);
        assertThat(bobRow.get("emails").get(0).get("mappedByName").asText()).isEqualTo("Pam Le");
        assertThat(bobRow.get("activity").get("commits").asLong()).isEqualTo(1);

        mvc.perform(delete(assign, masterId, home).header("Authorization", "Bearer " + pamToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").doesNotExist());
        assertThat(contributor("email:bob@home.test").getUserId()).isNull();
    }

    @Test
    void aMemberSeesTheAccountsButCannotManageThem() throws Exception {
        overview(bobToken, moduleId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.master.id").value(masterId))
                .andExpect(jsonPath("$.viewer.canConnect").value(true))
                .andExpect(jsonPath("$.viewer.canManage").value(false))
                .andExpect(jsonPath("$.viewer.mapped").value(false))
                .andExpect(jsonPath("$.members", hasSize(4)))
                .andExpect(jsonPath("$.members[0].name").value("Alice Nguyen"))
                .andExpect(jsonPath("$.members[0].projects[0].id").value(masterId));
        overview(carolToken, masterId).andExpect(status().isForbidden());
    }

    private static JsonNode find(JsonNode array, String field, Object value) {
        for (JsonNode node : array) {
            if (node.hasNonNull(field) && node.get(field).asText().equals(String.valueOf(value))) return node;
        }
        throw new AssertionError("No element with " + field + "=" + value + " in " + array);
    }
}
