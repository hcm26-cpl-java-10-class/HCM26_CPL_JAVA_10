package com.example.starter_project_2025.system.project;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.rbac.user.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.slf4j.MDC;

@ExtendWith(MockitoExtension.class)
class ProjectTeamRoleServiceTest {

    @Mock
    private TeamAllocationSessionRepository sessionRepository;

    @Mock
    private ProjectTeamRepository teamRepository;

    @Mock
    private ProjectMemberRepository memberRepository;

    @Mock
    private ScopeAuthorizationService scopeAuthorizationService;

    @Mock
    private ProjectTeamAuditRepository auditRepository;

    @Mock
    private ProjectTeamOutboxRepository outboxRepository;

    @Mock
    private ProjectTeamMemberHistoryService historyService;

    @Mock
    private EntityManager entityManager;

    private ProjectTeamRoleService service;
    private TeamAllocationSession session;
    private ProjectTeam team;
    private ProjectMember member;
    private Authentication authentication;

    @BeforeEach
    void setUp() {
        service = new ProjectTeamRoleService(
                sessionRepository,
                teamRepository,
                memberRepository,
                scopeAuthorizationService,
                auditRepository,
                outboxRepository,
                historyService,
                entityManager,
                new ObjectMapper());

        TrainingClass trainingClass = TrainingClass.builder().id(7L).build();
        session = TeamAllocationSession.builder()
                .id(11L)
                .trainingClass(trainingClass)
                .status(TeamAllocationSessionStatus.OPEN)
                .build();
        team = ProjectTeam.builder()
                .id(13L)
                .trainingClass(trainingClass)
                .allocationSession(session)
                .status(ProjectTeamStatus.ACTIVE)
                .version(4L)
                .build();
        member = ProjectMember.builder()
                .id(17L)
                .team(team)
                .classMember(ClassMember.builder().id(19L).build())
                .role(null)
                .build();

        User actor = new User();
        actor.setId(23L);
        authentication = new UsernamePasswordAuthenticationToken(
                new UserPrincipal(actor, List.of(
                        new SimpleGrantedAuthority("PRJ_WORKSPACE_MANAGE"))),
                null,
                List.of(new SimpleGrantedAuthority("PRJ_WORKSPACE_MANAGE")));

        when(sessionRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(session));
        when(teamRepository.findByIdAndAllocationSession_Id(13L, 11L))
                .thenReturn(Optional.of(team));
    }

    @AfterEach
    void clearCorrelationId() {
        MDC.remove(CorrelationIdFilter.MDC_KEY);
    }

    @Test
    void updatesRolesAndWritesAuditAndOutboxInOneChange() {
        when(memberRepository.findAllByTeam_IdOrderByIdAsc(13L))
                .thenReturn(List.of(member));
        MDC.put(CorrelationIdFilter.MDC_KEY, "role-assignment-test");

        service.updateRoles(
                7L,
                11L,
                13L,
                new UpdateTeamRolesRequest(
                        4L,
                        List.of(new UpdateTeamRolesRequest.MemberRoleAssignment(19L, "PM"))),
                authentication);

        assertEquals("PM", member.getRole());
        verify(entityManager).lock(team, LockModeType.OPTIMISTIC_FORCE_INCREMENT);
        verify(memberRepository).saveAllAndFlush(List.of(member));
        verify(historyService).record(
                session,
                member.getClassMember(),
                team,
                team,
                null,
                "PM",
                "ROLE_CHANGED",
                null,
                authentication);
        ArgumentCaptor<ProjectTeamAudit> auditCaptor =
                ArgumentCaptor.forClass(ProjectTeamAudit.class);
        ArgumentCaptor<ProjectTeamOutboxEvent> outboxCaptor =
                ArgumentCaptor.forClass(ProjectTeamOutboxEvent.class);
        verify(auditRepository).save(auditCaptor.capture());
        verify(outboxRepository).save(outboxCaptor.capture());
        ProjectTeamAudit audit = auditCaptor.getValue();
        ProjectTeamOutboxEvent event = outboxCaptor.getValue();
        assertEquals("UPDATE_TEAM_MEMBER_ROLES", audit.getAction());
        assertEquals(23L, audit.getActorId());
        assertEquals(7L, audit.getClassId());
        assertEquals(11L, audit.getAllocationSessionId());
        assertNotNull(audit.getBeforeState());
        assertNotNull(audit.getAfterState());
        assertEquals("role-assignment-test", audit.getCorrelationId());
        assertEquals("PROJECT_TEAM_MEMBER_ROLES_UPDATED", event.getEventType());
        assertEquals(13L, event.getAggregateId());
        assertEquals(audit.getAfterState(), event.getPayload());
        assertEquals(audit.getCorrelationId(), event.getCorrelationId());
        assertFalse(event.getPayload().isBlank());
    }

    @Test
    void rejectsInvalidRoleAndIdentifiesMember() {
        when(memberRepository.findAllByTeam_IdOrderByIdAsc(13L))
                .thenReturn(List.of(member));

        TeamRoleAssignmentException exception = assertThrows(
                TeamRoleAssignmentException.class,
                () -> service.updateRoles(
                        7L,
                        11L,
                        13L,
                        new UpdateTeamRolesRequest(
                                4L,
                                List.of(new UpdateTeamRolesRequest.MemberRoleAssignment(
                                        19L, "LEAD"))),
                        authentication));

        assertEquals(List.of(19L), exception.getInvalidMemberIds());
        verify(auditRepository, never()).save(any(ProjectTeamAudit.class));
        verify(outboxRepository, never()).save(any(ProjectTeamOutboxEvent.class));
    }

    @Test
    void doesNotWriteHistoryForDraftRoleChanges() {
        team.setStatus(ProjectTeamStatus.DRAFT);
        when(memberRepository.findAllByTeam_IdOrderByIdAsc(13L))
                .thenReturn(List.of(member));

        service.updateRoles(
                7L,
                11L,
                13L,
                new UpdateTeamRolesRequest(
                        4L,
                        List.of(new UpdateTeamRolesRequest.MemberRoleAssignment(19L, "PM"))),
                authentication);

        assertEquals("PM", member.getRole());
        verifyNoInteractions(historyService);
    }

    @Test
    void rejectsStaleTeamVersionBeforeChangingAssignments() {
        assertThrows(
                TeamVersionConflictException.class,
                () -> service.updateRoles(
                        7L,
                        11L,
                        13L,
                        new UpdateTeamRolesRequest(
                                3L,
                                List.of(new UpdateTeamRolesRequest.MemberRoleAssignment(
                                        19L, "PM"))),
                        authentication));

        verify(memberRepository, never()).saveAllAndFlush(any());
        verify(auditRepository, never()).save(any(ProjectTeamAudit.class));
        verify(outboxRepository, never()).save(any(ProjectTeamOutboxEvent.class));
    }
}
