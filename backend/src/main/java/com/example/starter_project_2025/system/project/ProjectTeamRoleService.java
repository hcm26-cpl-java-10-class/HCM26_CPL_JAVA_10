package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.OptimisticLockException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProjectTeamRoleService {

    private final TeamAllocationSessionRepository sessionRepository;
    private final ProjectTeamRepository teamRepository;
    private final ProjectMemberRepository memberRepository;
    private final ScopeAuthorizationService scopeAuthorizationService;
    private final ProjectTeamAuditRepository auditRepository;
    private final ProjectTeamOutboxRepository outboxRepository;
    private final ProjectTeamMemberHistoryService historyService;
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;

    @Transactional
    public void updateRoles(
            Long classId,
            Long sessionId,
            Long teamId,
            UpdateTeamRolesRequest request,
            Authentication authentication
    ) {
        TeamAllocationSession session = sessionRepository.findByIdForUpdate(sessionId)
                .filter(value -> value.getTrainingClass().getId().equals(classId))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TeamAllocationSession", "id", sessionId));
        scopeAuthorizationService.assertCanManageTeamMentor(
                authentication, session.getTrainingClass());
        if (session.getStatus() != TeamAllocationSessionStatus.OPEN
                && session.getStatus() != TeamAllocationSessionStatus.PUBLISHED) {
            throw new BadRequestException(
                    "Phiên phân nhóm hiện không cho phép cập nhật vai trò");
        }

        ProjectTeam team = teamRepository.findByIdAndAllocationSession_Id(teamId, sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectTeam", "id", teamId));
        if (team.getStatus() != ProjectTeamStatus.DRAFT
                && team.getStatus() != ProjectTeamStatus.ACTIVE) {
            throw new BadRequestException(
                    "Chỉ có thể cập nhật vai trò cho nhóm DRAFT hoặc ACTIVE");
        }
        if (request == null || request.expectedVersion() == null) {
            throw new TeamRoleAssignmentException(
                    "Version nhóm là bắt buộc", List.of());
        }
        if (!request.expectedVersion().equals(team.getVersion())) {
            throw new TeamVersionConflictException();
        }

        List<ProjectMember> assignments =
                memberRepository.findAllByTeam_IdOrderByIdAsc(teamId);
        Map<Long, ProjectMember> assignmentsByMemberId = new HashMap<>();
        assignments.forEach(assignment ->
                assignmentsByMemberId.put(assignment.getClassMember().getId(), assignment));

        List<Long> invalidMemberIds = new ArrayList<>();
        Map<Long, String> requestedRoles = new HashMap<>();
        Set<Long> seenMemberIds = new HashSet<>();
        List<UpdateTeamRolesRequest.MemberRoleAssignment> requestedMembers =
                request.members() == null ? List.of() : request.members();

        for (UpdateTeamRolesRequest.MemberRoleAssignment member : requestedMembers) {
            if (member == null || member.memberId() == null
                    || !seenMemberIds.add(member.memberId())) {
                if (member != null && member.memberId() != null) {
                    invalidMemberIds.add(member.memberId());
                }
                continue;
            }
            if (!assignmentsByMemberId.containsKey(member.memberId())
                    || !ProjectMemberRole.isValid(member.role())) {
                invalidMemberIds.add(member.memberId());
                continue;
            }
            requestedRoles.put(member.memberId(), member.role());
        }

        assignmentsByMemberId.keySet().stream()
                .filter(memberId -> !requestedRoles.containsKey(memberId))
                .forEach(invalidMemberIds::add);

        if (requestedMembers.size() != assignmentsByMemberId.size()
                || !invalidMemberIds.isEmpty()) {
            throw new TeamRoleAssignmentException(
                    "Vui lòng chọn vai trò hợp lệ cho từng thành viên trong nhóm",
                    invalidMemberIds.stream().distinct().toList());
        }

        List<ProjectMember> changedAssignments = assignments.stream()
                .filter(assignment -> !requestedRoles.get(
                        assignment.getClassMember().getId()).equals(assignment.getRole()))
                .toList();
        if (changedAssignments.isEmpty()) {
            return;
        }

        String beforeState = serialize(snapshot(team, assignments));
        Map<Long, String> previousRoles = new HashMap<>();
        changedAssignments.forEach(assignment -> previousRoles.put(
                assignment.getClassMember().getId(), assignment.getRole()));
        try {
            entityManager.lock(team, LockModeType.OPTIMISTIC_FORCE_INCREMENT);
            entityManager.flush();
        } catch (OptimisticLockException | OptimisticLockingFailureException conflict) {
            throw new TeamVersionConflictException();
        }
        changedAssignments.forEach(assignment -> assignment.setRole(
                requestedRoles.get(assignment.getClassMember().getId())));
        memberRepository.saveAllAndFlush(changedAssignments);
        String afterState = serialize(snapshot(team, assignments));
        if (team.getStatus() == ProjectTeamStatus.ACTIVE) {
            for (ProjectMember assignment : changedAssignments) {
                historyService.record(
                        session,
                        assignment.getClassMember(),
                        team,
                        team,
                        previousRoles.get(assignment.getClassMember().getId()),
                        requestedRoles.get(assignment.getClassMember().getId()),
                        "ROLE_CHANGED",
                        null,
                        authentication);
            }
        }

        Long actorId = ((UserPrincipal) authentication.getPrincipal()).getUser().getId();
        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = UUID.randomUUID().toString();
        }
        auditRepository.save(ProjectTeamAudit.builder()
                .action("UPDATE_TEAM_MEMBER_ROLES")
                .actorId(actorId)
                .classId(classId)
                .allocationSessionId(sessionId)
                .beforeState(beforeState)
                .afterState(afterState)
                .correlationId(correlationId)
                .build());
        outboxRepository.save(ProjectTeamOutboxEvent.builder()
                .eventType("PROJECT_TEAM_MEMBER_ROLES_UPDATED")
                .aggregateId(teamId)
                .payload(afterState)
                .correlationId(correlationId)
                .status("PENDING")
                .build());
    }

    private TeamSnapshot snapshot(ProjectTeam team, List<ProjectMember> assignments) {
        return new TeamSnapshot(
                team.getId(),
                team.getVersion(),
                assignments.stream()
                        .map(assignment -> new MemberRoleSnapshot(
                                assignment.getClassMember().getId(),
                                assignment.getRole()))
                        .toList());
    }

    private String serialize(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize team role state", exception);
        }
    }

    private record TeamSnapshot(
            Long teamId,
            Long version,
            List<MemberRoleSnapshot> members
    ) {
    }

    private record MemberRoleSnapshot(Long memberId, String role) {
    }
}
