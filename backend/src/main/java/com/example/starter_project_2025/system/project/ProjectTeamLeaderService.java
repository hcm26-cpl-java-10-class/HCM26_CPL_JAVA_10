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
    private final ProjectTeamMemberHistoryService history;
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
        if (session.getStatus() != TeamAllocationSessionStatus.OPEN || team.getStatus() != ProjectTeamStatus.DRAFT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Chỉ có thể chọn Leader khi nhóm còn Draft");
        }
        if (!request.expectedVersion().equals(team.getVersion())) throw new TeamVersionConflictException();
        List<ProjectMember> roster = members.findAllByTeam_IdOrderByIdAsc(teamId);
        ProjectMember selected = roster.stream()
                .filter(row -> row.getClassMember().getId().equals(request.memberId()))
                .findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "Học viên không thuộc nhóm"));
        if (!AllocationStudentEligibility.isEligible(selected.getClassMember())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Học viên không còn ACTIVE trong lớp");
        }
        List<ProjectMember> currentPm = roster.stream()
                .filter(row -> ProjectMemberRole.hasRole(row.getRole(), "PM")).toList();
        Long oldId = team.getLeaderMemberId();
        if (oldId == null && currentPm.size() == 1) oldId = currentPm.get(0).getClassMember().getId();
        if (oldId != null && !oldId.equals(request.memberId()) && !request.confirmReplacement()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Nhóm đã có Leader; cần xác nhận thay thế");
        }
        if (request.memberId().equals(oldId) && currentPm.size() == 1
                && currentPm.get(0).getClassMember().getId().equals(oldId)) return oldId;
        String before = snapshot(team, roster);
        entityManager.lock(team, LockModeType.OPTIMISTIC_FORCE_INCREMENT);
        entityManager.flush();
        boolean multi = team.getProjectTemplate() != null
                && ProjectTemplateConstraints.parseRolePolicy(mapper, team.getProjectTemplate()).allowMultiRole();
        for (ProjectMember row : roster) {
            String previous = row.getRole();
            List<String> roles = new java.util.ArrayList<>(ProjectMemberRole.parseRoles(previous));
            roles.remove("PM");
            if (row == selected) {
                if (!multi) roles.clear();
                roles.add("PM");
            } else if (roles.isEmpty()) roles.add("DEV");
            String updated = ProjectMemberRole.formatRoles(roles);
            if (!java.util.Objects.equals(previous, updated)) {
                row.setRole(updated);
                history.record(session, row.getClassMember(), team, team, previous, updated,
                        "ROLE_CHANGED", "LEADER_CHANGED", actor);
            }
        }
        team.setLeaderMemberId(request.memberId());
        members.saveAllAndFlush(roster);
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
