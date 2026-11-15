package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class ProjectTeamLeaderService {
    private final TeamAllocationSessionRepository sessions;
    private final ProjectTeamRepository teams;
    private final ProjectMemberRepository members;
    private final ScopeAuthorizationService authorization;
    private final ProjectTeamAuditRepository audits;
    private final ProjectTeamOutboxRepository outbox;
    private final EntityManager entityManager;
    private final ObjectMapper mapper;

    @Transactional
    public Long assign(Long classId, Long sessionId, Long teamId,
                       AssignTeamLeaderRequest request, Authentication actor) {
        TeamAllocationSession session = sessions.findByIdForUpdate(sessionId)
                .filter(row -> row.getTrainingClass().getId().equals(classId))
                .orElseThrow(() -> new ResourceNotFoundException("TeamAllocationSession", "id", sessionId));
        authorization.assertCanManageTeamMentor(actor, session.getTrainingClass());
        ProjectTeam team = teams.findByIdAndAllocationSession_Id(teamId, sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectTeam", "id", teamId));
        if (!request.expectedVersion().equals(team.getVersion())) throw new TeamVersionConflictException();
        List<ProjectMember> roster = members.findAllByTeam_IdOrderByIdAsc(teamId);
        Long oldId = activeLeaderId(team, roster);
        boolean open = session.getStatus() == TeamAllocationSessionStatus.OPEN;
        boolean editableDraft = open && team.getStatus() == ProjectTeamStatus.DRAFT;
        boolean activeWithoutLeader = team.getStatus() == ProjectTeamStatus.ACTIVE && oldId == null
                && (open || session.getStatus() == TeamAllocationSessionStatus.PUBLISHED);
        if (!editableDraft && !activeWithoutLeader) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Nhóm hiện không cho phép thay đổi Leader");
        }
        if (roster.stream().noneMatch(row -> row.getClassMember().getId().equals(request.memberId()) && eligible(row))) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Leader phải là thành viên ACTIVE của nhóm");
        }
        if (request.memberId().equals(oldId)) return oldId;
        if (oldId != null && !request.confirmReplacement()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Nhóm đã có Leader; cần xác nhận thay thế");
        }
        String before = snapshot(team, roster);
        entityManager.lock(team, LockModeType.OPTIMISTIC_FORCE_INCREMENT);
        entityManager.flush();
        team.setLeaderMemberId(request.memberId());
        teams.saveAndFlush(team);
        String after = snapshot(team, roster);
        String correlation = MDC.get(CorrelationIdFilter.MDC_KEY);
        if (correlation == null || correlation.isBlank()) correlation = UUID.randomUUID().toString();
        Long actorId = ((UserPrincipal) actor.getPrincipal()).getUser().getId();
        audits.save(ProjectTeamAudit.builder().action("ASSIGN_TEAM_LEADER").actorId(actorId)
                .classId(classId).allocationSessionId(sessionId).beforeState(before)
                .afterState(after).correlationId(correlation).build());
        outbox.save(ProjectTeamOutboxEvent.builder().eventType("PROJECT_TEAM_LEADER_CHANGED")
                .aggregateId(teamId).payload(after).correlationId(correlation).status("PENDING").build());
        return request.memberId();
    }

    public static Long activeLeaderId(ProjectTeam team, List<ProjectMember> roster) {
        return team.getLeaderMemberId() != null && roster.stream()
                .anyMatch(row -> team.isLedBy(row.getClassMember().getId()) && eligible(row))
                ? team.getLeaderMemberId() : null;
    }

    static boolean eligible(ProjectMember member) {
        var classMember = member.getClassMember();
        return Boolean.TRUE.equals(member.getIsActive()) && Boolean.TRUE.equals(classMember.getIsActive())
                && AllocationStudentEligibility.isEligible(classMember);
    }

    private String snapshot(ProjectTeam team, List<ProjectMember> roster) {
        try {
            return mapper.writeValueAsString(java.util.Map.of("teamId", team.getId(),
                    "leaderMemberId", team.getLeaderMemberId() == null ? "" : team.getLeaderMemberId(),
                    "roles", roster.stream().map(row -> java.util.Map.of("memberId",
                            row.getClassMember().getId(), "role", row.getRole() == null ? "" : row.getRole())).toList()));
        } catch (com.fasterxml.jackson.core.JsonProcessingException error) {
            throw new IllegalStateException(error);
        }
    }
}
