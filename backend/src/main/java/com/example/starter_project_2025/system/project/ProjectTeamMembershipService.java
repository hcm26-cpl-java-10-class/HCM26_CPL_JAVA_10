package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProjectTeamMembershipService {

    private final TeamAllocationSessionRepository sessionRepository;
    private final ProjectTeamRepository teamRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ClassMemberRepository classMemberRepository;
    private final ScopeAuthorizationService scopeAuthorizationService;
    private final ProjectTeamAuditRepository auditRepository;
    private final ProjectTeamOutboxRepository outboxRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public void addMember(
            Long classId,
            Long sessionId,
            Long teamId,
            AddActiveTeamMemberRequest request,
            Authentication authentication
    ) {
        TeamAllocationSession session = lockAndAuthorize(classId, sessionId, authentication);
        ProjectTeam team = requireActiveTeam(sessionId, teamId);
        ClassMember member = lockActiveMember(classId, request.memberId());

        if (projectMemberRepository.countByTeam_Id(teamId) >= team.getMaxMembers()) {
            throw new TeamCapacityExceededException(team.getMaxMembers());
        }
        List<ProjectMember> activeAssignments =
                projectMemberRepository.findMembersBySessionAndTeamStatus(
                        List.of(member.getId()), sessionId, ProjectTeamStatus.ACTIVE);
        if (!activeAssignments.isEmpty()) {
            ProjectMember assignment = activeAssignments.get(0);
            throw new StudentAlreadyAssignedException(
                    member.getId(),
                    assignment.getTeam().getId(),
                    member.getUser().getFullName());
        }

        String beforeState = serialize(snapshot(
                team,
                projectMemberRepository.findAllByTeam_IdOrderByIdAsc(teamId)));
        projectMemberRepository.saveAndFlush(
                ProjectMember.builder()
                        .team(team)
                        .classMember(member)
                        .role(null)
                        .build());
        List<ProjectMember> updatedMembers = new ArrayList<>(
                projectMemberRepository.findAllByTeam_IdOrderByIdAsc(teamId));
        String afterState = serialize(snapshot(team, updatedMembers));
        recordChange(session, team, authentication, "ADD_ACTIVE_TEAM_MEMBER",
                "PROJECT_TEAM_MEMBER_ADDED", beforeState, afterState);
    }

    @Transactional
    public void removeMember(
            Long classId,
            Long sessionId,
            Long teamId,
            Long memberId,
            RemoveActiveTeamMemberRequest request,
            Authentication authentication
    ) {
        TeamAllocationSession session = lockAndAuthorize(classId, sessionId, authentication);
        ProjectTeam team = requireActiveTeam(sessionId, teamId);
        lockActiveMember(classId, memberId);
        List<ProjectMember> oldMembers =
                projectMemberRepository.findAllByTeam_IdOrderByIdAsc(teamId);
        ProjectMember removed = oldMembers.stream()
                .filter(item -> item.getClassMember().getId().equals(memberId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException(
                        "ProjectMember", "memberId", memberId));
        String beforeState = serialize(snapshot(team, oldMembers));
        projectMemberRepository.delete(removed);
        projectMemberRepository.flush();
        List<ProjectMember> updatedMembers =
                projectMemberRepository.findAllByTeam_IdOrderByIdAsc(teamId);
        String afterState = serialize(new MembershipSnapshot(
                snapshot(team, updatedMembers), request.reason().trim()));
        recordChange(session, team, authentication, "REMOVE_ACTIVE_TEAM_MEMBER",
                "PROJECT_TEAM_MEMBER_REMOVED", beforeState, afterState);
    }

    @Transactional
    public void swapMember(
            Long classId,
            Long sessionId,
            Long teamId,
            Long memberId,
            SwapActiveTeamMemberRequest request,
            Authentication authentication
    ) {
        TeamAllocationSession session = lockAndAuthorize(classId, sessionId, authentication);
        ProjectTeam sourceTeam = requireActiveTeam(sessionId, teamId);
        if (memberId.equals(request.replacementMemberId())) {
            throw new BadRequestException("A member cannot be swapped with themselves");
        }
        List<ClassMember> lockedMembers = classMemberRepository
                .findAllByIdInAndStatusForUpdate(
                        classId,
                        List.of(memberId, request.replacementMemberId()).stream()
                                .sorted()
                                .toList(),
                        ClassMemberStatus.ACTIVE);
        if (lockedMembers.size() != 2) {
            throw new ResourceNotFoundException(
                    "Active class member", "id", request.replacementMemberId());
        }
        ClassMember originalMember = lockedMembers.stream()
                .filter(member -> member.getId().equals(memberId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Active class member", "id", memberId));
        ClassMember replacementMember = lockedMembers.stream()
                .filter(member -> member.getId().equals(request.replacementMemberId()))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Active class member", "id", request.replacementMemberId()));

        List<ProjectMember> sourceMembers =
                projectMemberRepository.findAllByTeam_IdOrderByIdAsc(teamId);
        ProjectMember originalAssignment = sourceMembers.stream()
                .filter(item -> item.getClassMember().getId().equals(memberId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException(
                        "ProjectMember", "memberId", memberId));

        ProjectTeam destinationTeam = null;
        ProjectMember replacementAssignment = null;
        List<ProjectMember> destinationMembers = List.of();
        if (request.replacementTeamId() == null) {
            List<ProjectMember> assignments =
                    projectMemberRepository.findMembersBySessionAndTeamStatus(
                            List.of(replacementMember.getId()),
                            sessionId,
                            ProjectTeamStatus.ACTIVE);
            if (!assignments.isEmpty()) {
                ProjectMember assignment = assignments.get(0);
                throw new StudentAlreadyAssignedException(
                        replacementMember.getId(),
                        assignment.getTeam().getId(),
                        replacementMember.getUser().getFullName());
            }
        } else {
            destinationTeam = requireActiveTeam(sessionId, request.replacementTeamId());
            if (destinationTeam.getId().equals(sourceTeam.getId())) {
                throw new BadRequestException(
                        "Replacement team must differ from the source team");
            }
            destinationMembers = projectMemberRepository
                    .findAllByTeam_IdOrderByIdAsc(destinationTeam.getId());
            replacementAssignment = destinationMembers.stream()
                    .filter(item -> item.getClassMember().getId()
                            .equals(replacementMember.getId()))
                    .findFirst()
                    .orElseThrow(() -> new BadRequestException(
                            "Replacement member does not belong to the selected team"));
        }

        String sourceBefore = serialize(snapshot(sourceTeam, sourceMembers));
        String destinationBefore = destinationTeam == null
                ? null
                : serialize(snapshot(destinationTeam, destinationMembers));
        projectMemberRepository.delete(originalAssignment);
        if (replacementAssignment != null) {
            projectMemberRepository.delete(replacementAssignment);
        }
        projectMemberRepository.flush();

        projectMemberRepository.save(ProjectMember.builder()
                .team(sourceTeam)
                .classMember(replacementMember)
                .role(originalAssignment.getRole())
                .build());
        if (destinationTeam != null) {
            projectMemberRepository.save(ProjectMember.builder()
                    .team(destinationTeam)
                    .classMember(originalMember)
                    .role(replacementAssignment.getRole())
                    .build());
        }
        projectMemberRepository.flush();

        String reason = request.reason() == null ? null : request.reason().trim();
        String sourceAfter = serialize(new MembershipSnapshot(
                snapshot(sourceTeam,
                        projectMemberRepository.findAllByTeam_IdOrderByIdAsc(teamId)),
                reason));
        recordChange(session, sourceTeam, authentication, "SWAP_ACTIVE_TEAM_MEMBER",
                "PROJECT_TEAM_MEMBER_SWAPPED", sourceBefore, sourceAfter);
        if (destinationTeam != null) {
            String destinationAfter = serialize(new MembershipSnapshot(
                    snapshot(destinationTeam,
                            projectMemberRepository.findAllByTeam_IdOrderByIdAsc(
                                    destinationTeam.getId())),
                    reason));
            recordChange(session, destinationTeam, authentication,
                    "SWAP_ACTIVE_TEAM_MEMBER", "PROJECT_TEAM_MEMBER_SWAPPED",
                    destinationBefore, destinationAfter);
        }
    }

    private TeamAllocationSession lockAndAuthorize(
            Long classId,
            Long sessionId,
            Authentication authentication
    ) {
        TeamAllocationSession session = sessionRepository.findByIdForUpdate(sessionId)
                .filter(value -> value.getTrainingClass().getId().equals(classId))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TeamAllocationSession", "id", sessionId));
        scopeAuthorizationService.assertCanManageClass(
                authentication, session.getTrainingClass());
        if (session.getStatus() != TeamAllocationSessionStatus.OPEN
                && session.getStatus() != TeamAllocationSessionStatus.PUBLISHED) {
            throw new BadRequestException(
                    "Members can only be changed in OPEN or PUBLISHED sessions");
        }
        return session;
    }

    private ProjectTeam requireActiveTeam(Long sessionId, Long teamId) {
        ProjectTeam team = teamRepository.findByIdAndAllocationSession_Id(teamId, sessionId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "ProjectTeam", "id", teamId));
        if (team.getStatus() != ProjectTeamStatus.ACTIVE) {
            throw new BadRequestException("Only ACTIVE teams can be changed");
        }
        return team;
    }

    private ClassMember lockActiveMember(Long classId, Long memberId) {
        List<ClassMember> members = classMemberRepository.findAllByIdInAndStatusForUpdate(
                classId, List.of(memberId), ClassMemberStatus.ACTIVE);
        if (members.isEmpty()) {
            throw new ResourceNotFoundException("Active class member", "id", memberId);
        }
        return members.get(0);
    }

    private void recordChange(
            TeamAllocationSession session,
            ProjectTeam team,
            Authentication authentication,
            String action,
            String eventType,
            String beforeState,
            String afterState
    ) {
        Long actorId = ((UserPrincipal) authentication.getPrincipal()).getUser().getId();
        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = UUID.randomUUID().toString();
        }
        auditRepository.save(ProjectTeamAudit.builder()
                .action(action)
                .actorId(actorId)
                .classId(team.getTrainingClass().getId())
                .allocationSessionId(session.getId())
                .beforeState(beforeState)
                .afterState(afterState)
                .correlationId(correlationId)
                .build());
        outboxRepository.save(ProjectTeamOutboxEvent.builder()
                .eventType(eventType)
                .aggregateId(team.getId())
                .payload(afterState)
                .correlationId(correlationId)
                .status("PENDING")
                .build());
    }

    private TeamSnapshot snapshot(ProjectTeam team, List<ProjectMember> assignments) {
        return new TeamSnapshot(
                team.getId(),
                team.getTeamName(),
                team.getMaxMembers(),
                team.getStatus(),
                assignments.stream()
                        .map(member -> new TeamMemberSnapshot(
                                member.getClassMember().getId(), member.getRole()))
                        .toList());
    }

    private String serialize(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize team membership state", exception);
        }
    }

    private record MembershipSnapshot(TeamSnapshot team, String reason) {
    }

    private record TeamSnapshot(
            Long teamId,
            String teamName,
            Integer maxMembers,
            ProjectTeamStatus status,
            List<TeamMemberSnapshot> members
    ) {
    }

    private record TeamMemberSnapshot(Long memberId, String role) {
    }
}
