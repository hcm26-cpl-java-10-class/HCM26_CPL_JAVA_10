package com.example.starter_project_2025.system.project;

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
    void remainderMembersBecomeANewDraftTeamWithStandardCapacity() {
        TrainingClass trainingClass = trainingClass();
        TeamAllocationSession current = session(trainingClass, 5);
        for (int i = 0; i < 7; i++) member(trainingClass);
        entityManager.clear();

        AutoAllocationService service = service();
        AutoAllocationPreview preview = service.preview(trainingClass.getId(), current.getId(), actor());
        assertEquals(List.of(5, 2), preview.teams().stream()
                .map(team -> team.members().size()).toList());

        List<Long> ids = preview.teams().stream().flatMap(team -> team.members().stream())
                .map(AutoAllocationPreview.Member::memberId).toList();
        AutoAllocationConfirmRequest oldSplit = new AutoAllocationConfirmRequest(preview.fingerprint(),
                List.of(new AutoAllocationConfirmRequest.Team("Old 1", ids.subList(0, 4)),
                        new AutoAllocationConfirmRequest.Team("Old 2", ids.subList(4, 7))));
        AutoAllocationException stale = assertThrows(AutoAllocationException.class,
                () -> service.confirm(trainingClass.getId(), current.getId(), oldSplit, actor()));
        assertEquals("ERR_AUTO_ALLOCATION_STALE", stale.getCode());

        AutoAllocationConfirmRequest request = new AutoAllocationConfirmRequest(preview.fingerprint(),
                preview.teams().stream().map(team -> new AutoAllocationConfirmRequest.Team(
                        team.teamName(), team.members().stream()
                                .map(AutoAllocationPreview.Member::memberId).toList())).toList());
        service.confirm(trainingClass.getId(), current.getId(), request, actor());

        List<ProjectTeam> saved = teams.findAllByAllocationSession_IdOrderByIdAsc(current.getId());
        assertEquals(2, saved.size());
        assertEquals(List.of(5, 5), saved.stream().map(ProjectTeam::getMaxMembers).toList());
        assertEquals(List.of(5L, 2L), saved.stream()
                .map(team -> projectMembers.countByTeam_Id(team.getId())).toList());
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
        return entityManager.persistAndFlush(TeamAllocationSession.builder()
                .trainingClass(trainingClass).maxMembers(maxMembers)
                .status(TeamAllocationSessionStatus.OPEN).build());
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
