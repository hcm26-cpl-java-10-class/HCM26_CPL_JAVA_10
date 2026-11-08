package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassStatus;
import com.example.starter_project_2025.system.rbac.user.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest
@ActiveProfiles("test")
class AutoAllocationSessionScopeTest {
    @Autowired private TestEntityManager entityManager;
    @Autowired private TeamAllocationSessionRepository sessions;
    @Autowired private com.example.starter_project_2025.system.project.trainingclass.ClassMemberRepository classMembers;
    @Autowired private ProjectMemberRepository projectMembers;
    @Autowired private ProjectTeamRepository teams;
    @Autowired private ProjectTeamAuditRepository audits;
    @Autowired private ProjectTeamOutboxRepository outbox;

    @Test
    void previousSessionAssignmentsDoNotBlockPreviewOrConfirmInNewSession() {
        TrainingClass trainingClass = trainingClass();
        TeamAllocationSession previous = session(trainingClass, 2);
        TeamAllocationSession current = session(trainingClass, 2);
        List<ClassMember> members = List.of(member(trainingClass), member(trainingClass),
                member(trainingClass), member(trainingClass));
        ProjectTeam previousTeam = team(previous, ProjectTeamStatus.ACTIVE);
        members.forEach(member -> assign(previousTeam, member));
        entityManager.clear();

        AutoAllocationService service = service();
        AutoAllocationPreview preview = service.preview(trainingClass.getId(), current.getId(), actor());
        assertEquals(4, preview.eligibleCount());
        assertEquals(4, preview.teams().stream().flatMap(team -> team.members().stream())
                .map(AutoAllocationPreview.Member::memberId).distinct().count());

        AutoAllocationConfirmRequest request = new AutoAllocationConfirmRequest(preview.fingerprint(),
                preview.teams().stream().map(team -> new AutoAllocationConfirmRequest.Team(
                        team.teamName(), team.members().stream()
                                .map(AutoAllocationPreview.Member::memberId).toList())).toList());
        BatchSaveDraftResponse saved = service.confirm(trainingClass.getId(), current.getId(), request, actor());

        assertEquals(2, saved.teams().size());
        assertEquals(4, projectMembers.findAssignedMemberIdsBySessionAndTeamStatuses(current.getId(),
                List.of(ProjectTeamStatus.DRAFT, ProjectTeamStatus.ACTIVE)).size());
        assertEquals(4, projectMembers.findAssignedMemberIdsBySessionAndTeamStatuses(previous.getId(),
                List.of(ProjectTeamStatus.DRAFT, ProjectTeamStatus.ACTIVE)).size());
        AutoAllocationException noEligible = assertThrows(AutoAllocationException.class,
                () -> service.preview(trainingClass.getId(), current.getId(), actor()));
        assertEquals(HttpStatus.CONFLICT, noEligible.getStatus());
        assertEquals("ERR_NO_ELIGIBLE_MEMBERS", noEligible.getCode());
    }

    @Test
    void remainderIsSpreadEvenlyAcrossTeamsWithStandardCapacity() {
        TrainingClass trainingClass = trainingClass();
        TeamAllocationSession current = session(trainingClass, 5);
        for (int i = 0; i < 7; i++) member(trainingClass);
        entityManager.clear();

        AutoAllocationService service = service();
        AutoAllocationPreview preview = service.preview(trainingClass.getId(), current.getId(), actor());
        assertEquals(List.of(4, 3), sizesOf(preview));
        assertEquals(1, preview.minMembers());
        assertEquals(5, preview.standardMax());

        List<Long> ids = memberIds(preview);
        AutoAllocationConfirmRequest greedySplit = new AutoAllocationConfirmRequest(preview.fingerprint(),
                List.of(new AutoAllocationConfirmRequest.Team("Old 1", ids.subList(0, 5)),
                        new AutoAllocationConfirmRequest.Team("Old 2", ids.subList(5, 7))));
        AutoAllocationException stale = assertThrows(AutoAllocationException.class,
                () -> service.confirm(trainingClass.getId(), current.getId(), greedySplit, actor()));
        assertEquals("ERR_AUTO_ALLOCATION_STALE", stale.getCode());

        service.confirm(trainingClass.getId(), current.getId(), confirmRequest(preview), actor());

        List<ProjectTeam> saved = teams.findAllByAllocationSession_IdOrderByIdAsc(current.getId());
        assertEquals(2, saved.size());
        assertEquals(List.of(5, 5), saved.stream().map(ProjectTeam::getMaxMembers).toList());
        assertEquals(List.of(4L, 3L), saved.stream()
                .map(team -> projectMembers.countByTeam_Id(team.getId())).toList());
    }

    @Test
    void templateMinimumIsRespectedInsteadOfCreatingATinyRemainderTeam() {
        TrainingClass trainingClass = trainingClass();
        TeamAllocationSession current = session(trainingClass, 5, template("{\"min_members\":4,\"max_members\":5}"));
        for (int i = 0; i < 9; i++) member(trainingClass);
        entityManager.clear();

        AutoAllocationPreview preview = service().preview(trainingClass.getId(), current.getId(), actor());
        assertEquals(List.of(5, 4), sizesOf(preview));
        assertEquals(4, preview.minMembers());
    }

    @Test
    void infeasibleWindowIsRejectedWithAnExplicitError() {
        TrainingClass trainingClass = trainingClass();
        TeamAllocationSession current = session(trainingClass, 5, template("{\"min_members\":4,\"max_members\":5}"));
        for (int i = 0; i < 6; i++) member(trainingClass);
        entityManager.clear();

        AutoAllocationException error = assertThrows(AutoAllocationException.class,
                () -> service().preview(trainingClass.getId(), current.getId(), actor()));
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, error.getStatus());
        assertEquals("ERR_ALLOCATION_INFEASIBLE", error.getCode());
    }

    @Test
    void sessionCapacityBelowTemplateMinimumIsRejected() {
        TrainingClass trainingClass = trainingClass();
        TeamAllocationSession current = session(trainingClass, 3, template("{\"min_members\":4,\"max_members\":6}"));
        for (int i = 0; i < 8; i++) member(trainingClass);
        entityManager.clear();

        AutoAllocationException error = assertThrows(AutoAllocationException.class,
                () -> service().preview(trainingClass.getId(), current.getId(), actor()));
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, error.getStatus());
        assertEquals("ERR_INVALID_TEAM_SIZE", error.getCode());
    }

    @Test
    void classSmallerThanCapacityBecomesASingleTeam() {
        TrainingClass trainingClass = trainingClass();
        TeamAllocationSession current = session(trainingClass, 5);
        for (int i = 0; i < 3; i++) member(trainingClass);
        entityManager.clear();

        AutoAllocationService service = service();
        AutoAllocationPreview preview = service.preview(trainingClass.getId(), current.getId(), actor());
        assertEquals(List.of(3), sizesOf(preview));
        BatchSaveDraftResponse saved = service.confirm(trainingClass.getId(), current.getId(),
                confirmRequest(preview), actor());
        assertEquals(1, saved.teams().size());
    }

    @Test
    void confirmPersistsDraftAutoTeamsWithAuditAndOutbox() {
        TrainingClass trainingClass = trainingClass();
        TeamAllocationSession current = session(trainingClass, 2);
        for (int i = 0; i < 4; i++) member(trainingClass);
        entityManager.clear();

        AutoAllocationService service = service();
        AutoAllocationPreview preview = service.preview(trainingClass.getId(), current.getId(), actor());
        service.confirm(trainingClass.getId(), current.getId(), confirmRequest(preview), actor());

        List<ProjectTeam> saved = teams.findAllByAllocationSession_IdOrderByIdAsc(current.getId());
        assertTrue(saved.stream().allMatch(team -> team.getStatus() == ProjectTeamStatus.DRAFT
                && team.getAllocationSource() == TeamAllocationSource.AUTO));
        assertEquals(List.of("DEV"), projectMembers.findAll().stream()
                .filter(member -> member.getTeam().getAllocationSession().getId().equals(current.getId()))
                .map(ProjectMember::getRole).distinct().toList());
        List<ProjectTeamAudit> auditRows = audits.findAll().stream()
                .filter(audit -> current.getId().equals(audit.getAllocationSessionId())).toList();
        assertEquals(1, auditRows.size());
        assertEquals("AUTO_CREATE_DRAFT", auditRows.get(0).getAction());
        List<ProjectTeamOutboxEvent> events = outbox.findAll().stream()
                .filter(event -> current.getId().equals(event.getAggregateId())).toList();
        assertEquals(1, events.size());
        assertEquals("PROJECT_TEAM_DRAFT_CREATED", events.get(0).getEventType());
        assertEquals(auditRows.get(0).getAfterState(), events.get(0).getPayload());
        for (ProjectTeam team : saved) {
            assertTrue(events.get(0).getPayload().contains("\"teamId\":" + team.getId()));
        }
    }

    @Test
    void confirmRejectsTamperedOrIncompleteRequests() {
        TrainingClass trainingClass = trainingClass();
        TeamAllocationSession current = session(trainingClass, 2);
        for (int i = 0; i < 4; i++) member(trainingClass);
        ClassMember foreign = member(trainingClass());
        entityManager.clear();

        AutoAllocationService service = service();
        AutoAllocationPreview preview = service.preview(trainingClass.getId(), current.getId(), actor());
        String fp = preview.fingerprint();
        List<Long> ids = memberIds(preview);
        java.util.function.BiFunction<String, List<Long>, AutoAllocationConfirmRequest.Team> team =
                AutoAllocationConfirmRequest.Team::new;

        List<AutoAllocationConfirmRequest> invalid = List.of(
                new AutoAllocationConfirmRequest(fp, List.of()),
                new AutoAllocationConfirmRequest(fp, null),
                new AutoAllocationConfirmRequest(null, confirmRequest(preview).teams()),
                new AutoAllocationConfirmRequest("not-the-fingerprint", confirmRequest(preview).teams()),
                // wrong team count
                new AutoAllocationConfirmRequest(fp, List.of(team.apply("A", ids))),
                // same member twice
                new AutoAllocationConfirmRequest(fp, List.of(team.apply("A", List.of(ids.get(0), ids.get(1))),
                        team.apply("B", List.of(ids.get(0), ids.get(2))))),
                // member outside the eligible set
                new AutoAllocationConfirmRequest(fp, List.of(team.apply("A", List.of(ids.get(0), ids.get(1))),
                        team.apply("B", List.of(ids.get(2), foreign.getId())))),
                // one member left out
                new AutoAllocationConfirmRequest(fp, List.of(team.apply("A", List.of(ids.get(0), ids.get(1))),
                        team.apply("B", List.of(ids.get(2))))),
                // team above capacity
                new AutoAllocationConfirmRequest(fp, List.of(team.apply("A", ids.subList(0, 3)),
                        team.apply("B", ids.subList(3, 4)))),
                // blank / too long name
                new AutoAllocationConfirmRequest(fp, List.of(team.apply(" ", ids.subList(0, 2)),
                        team.apply("B", ids.subList(2, 4)))),
                new AutoAllocationConfirmRequest(fp, List.of(team.apply("x".repeat(256), ids.subList(0, 2)),
                        team.apply("B", ids.subList(2, 4)))),
                new AutoAllocationConfirmRequest(fp, List.of(team.apply("A", null),
                        team.apply("B", ids.subList(2, 4)))));
        for (AutoAllocationConfirmRequest request : invalid) {
            AutoAllocationException error = assertThrows(AutoAllocationException.class,
                    () -> service.confirm(trainingClass.getId(), current.getId(), request, actor()));
            assertEquals("ERR_AUTO_ALLOCATION_STALE", error.getCode());
        }
        AutoAllocationException nullRequest = assertThrows(AutoAllocationException.class,
                () -> service.confirm(trainingClass.getId(), current.getId(), null, actor()));
        assertEquals("ERR_AUTO_ALLOCATION_STALE", nullRequest.getCode());
        assertTrue(teams.findAllByAllocationSession_IdOrderByIdAsc(current.getId()).isEmpty());
    }

    @Test
    void sessionMustBeOpenAndBelongToTheClass() {
        TrainingClass trainingClass = trainingClass();
        TeamAllocationSession closed = session(trainingClass, 2);
        closed.setStatus(TeamAllocationSessionStatus.CLOSED);
        sessions.saveAndFlush(closed);
        TeamAllocationSession open = session(trainingClass, 2);
        for (int i = 0; i < 2; i++) member(trainingClass);
        TrainingClass otherClass = trainingClass();
        entityManager.clear();

        AutoAllocationService service = service();
        AutoAllocationException notOpen = assertThrows(AutoAllocationException.class,
                () -> service.preview(trainingClass.getId(), closed.getId(), actor()));
        assertEquals("ERR_AUTO_ALLOCATION_STALE", notOpen.getCode());
        assertThrows(ResourceNotFoundException.class,
                () -> service.preview(otherClass.getId(), open.getId(), actor()));
    }

    @Test
    void changingSessionCapacityPreservesOnlyLegacyAutoExtraSeats() {
        TrainingClass trainingClass = trainingClass();
        TeamAllocationSession current = session(trainingClass, 5);
        current.setProjectTemplate(entityManager.persistAndFlush(ProjectTemplate.builder()
                .name("Capacity test template").build()));
        sessions.saveAndFlush(current);
        ProjectTeam legacy = team(current, ProjectTeamStatus.DRAFT);
        legacy.setAllocationSource(TeamAllocationSource.AUTO);
        legacy.setMaxMembers(6);
        teams.saveAndFlush(legacy);
        ProjectTeam currentAuto = team(current, ProjectTeamStatus.DRAFT);
        currentAuto.setAllocationSource(TeamAllocationSource.AUTO);
        for (int i = 0; i < 6; i++) assign(legacy, member(trainingClass));
        for (int i = 0; i < 5; i++) assign(currentAuto, member(trainingClass));

        ScopeAuthorizationService authorization = new ScopeAuthorizationService(null, null) {
            @Override
            public void assertCanManageClass(Authentication actor, TrainingClass value) {
                // Authorization is independent of the capacity rule under test.
            }
        };
        TeamAllocationSessionService service = new TeamAllocationSessionService(null, null,
                sessions, teams, projectMembers, null, null, authorization, null);

        service.updateMaxMembers(trainingClass.getId(), current.getId(),
                new UpdateAllocationSessionRequest(6), actor());
        assertEquals(7, teams.findById(legacy.getId()).orElseThrow().getMaxMembers());
        assertEquals(6, teams.findById(currentAuto.getId()).orElseThrow().getMaxMembers());

        service.updateMaxMembers(trainingClass.getId(), current.getId(),
                new UpdateAllocationSessionRequest(5), actor());
        assertEquals(6, teams.findById(legacy.getId()).orElseThrow().getMaxMembers());
        assertEquals(5, teams.findById(currentAuto.getId()).orElseThrow().getMaxMembers());
        assertThrows(TeamCapacityExceededException.class,
                () -> service.updateMaxMembers(trainingClass.getId(), current.getId(),
                        new UpdateAllocationSessionRequest(4), actor()));
    }

    @Test
    void currentSessionDraftAndActiveAssignmentsAreExcludedButArchivedOnesAreAvailable() {
        TrainingClass trainingClass = trainingClass();
        TeamAllocationSession current = session(trainingClass, 2);
        ClassMember inDraft = member(trainingClass);
        ClassMember inActive = member(trainingClass);
        ClassMember inArchived = member(trainingClass);
        ClassMember withoutTeam = member(trainingClass);
        ClassMember inactiveAccount = member(trainingClass);
        inactiveAccount.getUser().setIsActive(false);
        entityManager.flush();
        assign(team(current, ProjectTeamStatus.DRAFT), inDraft);
        assign(team(current, ProjectTeamStatus.ACTIVE), inActive);
        assign(team(current, ProjectTeamStatus.ARCHIVED), inArchived);
        entityManager.clear();

        AutoAllocationService service = service();
        AutoAllocationPreview preview = service.preview(trainingClass.getId(), current.getId(), actor());
        assertEquals(2, preview.eligibleCount());
        assertEquals(java.util.Set.of(inArchived.getId(), withoutTeam.getId()),
                preview.teams().stream().flatMap(team -> team.members().stream())
                        .map(AutoAllocationPreview.Member::memberId).collect(java.util.stream.Collectors.toSet()));

        assign(team(current, ProjectTeamStatus.DRAFT), withoutTeam);
        AutoAllocationConfirmRequest request = new AutoAllocationConfirmRequest(preview.fingerprint(),
                preview.teams().stream().map(team -> new AutoAllocationConfirmRequest.Team(
                        team.teamName(), team.members().stream()
                                .map(AutoAllocationPreview.Member::memberId).toList())).toList());
        AutoAllocationException stale = assertThrows(AutoAllocationException.class,
                () -> service.confirm(trainingClass.getId(), current.getId(), request, actor()));
        assertEquals(HttpStatus.CONFLICT, stale.getStatus());
        assertEquals("ERR_AUTO_ALLOCATION_STALE", stale.getCode());
    }

    private AutoAllocationService service() {
        ScopeAuthorizationService authorization = new ScopeAuthorizationService(null, null) {
            @Override
            public void assertCanManageClass(Authentication actor, TrainingClass trainingClass) {
                // Authorization is independent of the session membership rule under test.
            }
        };
        return new AutoAllocationService(sessions, classMembers, projectMembers, teams,
                authorization, audits, outbox, new ObjectMapper());
    }

    private Authentication actor() {
        User user = User.builder().id(1L).email("manager@example.com")
                .passwordHash("test").firstName("Manager").build();
        return new UsernamePasswordAuthenticationToken(new UserPrincipal(user, List.of()), null, List.of());
    }

    private TrainingClass trainingClass() {
        return entityManager.persistAndFlush(TrainingClass.builder()
                .code("CLASS-" + UUID.randomUUID()).name("Session scope test")
                .tenantId(1L).programId(1L).status(TrainingClassStatus.ONGOING).build());
    }

    private TeamAllocationSession session(TrainingClass trainingClass, int maxMembers) {
        return session(trainingClass, maxMembers, null);
    }

    private TeamAllocationSession session(TrainingClass trainingClass, int maxMembers, ProjectTemplate template) {
        return entityManager.persistAndFlush(TeamAllocationSession.builder()
                .trainingClass(trainingClass).projectTemplate(template).maxMembers(maxMembers)
                .status(TeamAllocationSessionStatus.OPEN).build());
    }

    private ProjectTemplate template(String constraintsJson) {
        return entityManager.persistAndFlush(ProjectTemplate.builder()
                .name("Template " + UUID.randomUUID()).constraintsJson(constraintsJson).build());
    }

    private static List<Integer> sizesOf(AutoAllocationPreview preview) {
        return preview.teams().stream().map(team -> team.members().size()).toList();
    }

    private static List<Long> memberIds(AutoAllocationPreview preview) {
        return preview.teams().stream().flatMap(team -> team.members().stream())
                .map(AutoAllocationPreview.Member::memberId).toList();
    }

    private static AutoAllocationConfirmRequest confirmRequest(AutoAllocationPreview preview) {
        return new AutoAllocationConfirmRequest(preview.fingerprint(),
                preview.teams().stream().map(team -> new AutoAllocationConfirmRequest.Team(
                        team.teamName(), team.members().stream()
                                .map(AutoAllocationPreview.Member::memberId).toList())).toList());
    }

    private ClassMember member(TrainingClass trainingClass) {
        String code = UUID.randomUUID().toString();
        User user = entityManager.persistAndFlush(User.builder().email(code + "@example.com")
                .passwordHash("test").firstName("Student").userCode(code).build());
        return entityManager.persistAndFlush(ClassMember.builder().trainingClass(trainingClass)
                .user(user).status(ClassMemberStatus.ACTIVE).build());
    }

    private ProjectTeam team(TeamAllocationSession session, ProjectTeamStatus status) {
        return entityManager.persistAndFlush(ProjectTeam.builder()
                .trainingClass(session.getTrainingClass()).allocationSession(session)
                .teamName("Team " + UUID.randomUUID()).maxMembers(5).status(status).build());
    }

    private void assign(ProjectTeam team, ClassMember member) {
        entityManager.persistAndFlush(ProjectMember.builder()
                .team(team).classMember(member).role("DEV").build());
    }
}
