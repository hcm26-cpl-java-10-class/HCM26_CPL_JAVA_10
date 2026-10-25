package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TeamPublishItemService {

    private final ProjectTeamRepository teamRepository;
    private final TeamAllocationSessionRepository sessionRepository;
    private final ProjectMemberRepository memberRepository;
    private final ClassMemberRepository classMemberRepository;
    private final ProjectTeamAuditRepository auditRepository;
    private final ProjectTeamOutboxRepository outboxRepository;
    private final ObjectMapper objectMapper;
    private final ProjectTeamMentorService teamMentorService;
    private final ProjectTeamMemberHistoryService historyService;

    @Transactional(noRollbackFor = {
            StudentAlreadyAssignedException.class,
            ResourceNotFoundException.class,
            TeamPublishValidationException.class
    })
    public void publish(
            Long sessionId,
            Long teamId,
            Long actorId,
            Authentication authentication
    ) {
        TeamAllocationSession session = sessionRepository.findByIdForUpdate(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TeamAllocationSession", "id", sessionId));
        ProjectTeam team = teamRepository.findByIdAndAllocationSession_Id(teamId, sessionId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "ProjectTeam", "id", teamId));

        if (team.getStatus() == ProjectTeamStatus.ACTIVE) {
            return;
        }
        if (session.getStatus() != TeamAllocationSessionStatus.OPEN) {
            throw new TeamPublishValidationException("Allocation session is not open");
        }
        if (team.getStatus() != ProjectTeamStatus.DRAFT) {
            throw new TeamPublishValidationException("Only DRAFT teams can be published");
        }

        List<ProjectMember> assignments = memberRepository.findAllByTeam_IdOrderByIdAsc(teamId);
        if (assignments.isEmpty()) {
            throw new TeamPublishValidationException(
                    "A team without members cannot be published");
        }
        if (assignments.stream().anyMatch(assignment ->
                !ProjectMemberRole.isValid(assignment.getRole()))) {
            throw new TeamPublishValidationException(
                    "Mỗi thành viên cần được gán một vai trò hợp lệ trước khi publish");
        }

        List<Long> memberIds = assignments.stream()
                .map(assignment -> assignment.getClassMember().getId())
                .distinct()
                .sorted()
                .toList();

        List<ClassMember> lockedMembers = classMemberRepository
                .findAllByIdInAndStatusForUpdate(
                        team.getTrainingClass().getId(),
                        memberIds,
                        ClassMemberStatus.ACTIVE);
        if (lockedMembers.size() != memberIds.size()) {
            throw new TeamPublishValidationException(
                    "A team member is no longer ACTIVE in this class");
        }

        List<ProjectMember> activeConflicts =
                memberRepository.findMembersBySessionAndTeamStatus(
                        memberIds, sessionId, ProjectTeamStatus.ACTIVE);
        if (!activeConflicts.isEmpty()) {
            ProjectMember conflict = activeConflicts.get(0);
            throw new StudentAlreadyAssignedException(
                    conflict.getClassMember().getId(),
                    conflict.getTeam().getId(),
                    conflict.getClassMember().getUser().getFullName());
        }

        Long assignedMentorId = teamMentorService.resolveMentorForPublish(team);
        String beforeState = serialize(snapshot(team, assignments, ProjectTeamStatus.DRAFT));
        team.setAssignedMentorId(assignedMentorId);
        team.setStatus(ProjectTeamStatus.ACTIVE);
        teamRepository.saveAndFlush(team);
        for (ProjectMember assignment : assignments) {
            historyService.record(
                    session,
                    assignment.getClassMember(),
                    null,
                    team,
                    null,
                    assignment.getRole(),
                    "MEMBER_ADDED",
                    null,
                    authentication);
        }
        String afterState = serialize(snapshot(team, assignments, ProjectTeamStatus.ACTIVE));

        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = UUID.randomUUID().toString();
        }
        auditRepository.save(ProjectTeamAudit.builder()
                .action("PUBLISH_TEAM")
                .actorId(actorId)
                .classId(team.getTrainingClass().getId())
                .allocationSessionId(sessionId)
                .beforeState(beforeState)
                .afterState(afterState)
                .correlationId(correlationId)
                .build());
        outboxRepository.save(ProjectTeamOutboxEvent.builder()
                .eventType("PROJECT_TEAM_PUBLISHED")
                .aggregateId(teamId)
                .payload(afterState)
                .correlationId(correlationId)
                .status("PENDING")
                .build());
    }

    private TeamSnapshot snapshot(
            ProjectTeam team,
            List<ProjectMember> assignments,
            ProjectTeamStatus status
    ) {
        return new TeamSnapshot(
                team.getId(),
                team.getTeamName(),
                team.getTrainingClass().getId(),
                team.getTrainingClass().getCohortId(),
                team.getTrainingClass().getTenantId(),
                team.getProjectId(),
                team.getMaxMembers(),
                status,
                team.getAssignedMentorId(),
                assignments.stream()
                        .map(assignment -> new TeamMemberSnapshot(
                                assignment.getClassMember().getId(),
                                assignment.getRole()))
                        .toList()
        );
    }

    private String serialize(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize team state", exception);
        }
    }

    private record TeamSnapshot(
            Long teamId,
            String teamName,
            Long classId,
            Long cohortId,
            Long tenantId,
            Long projectId,
            Integer maxMembers,
            ProjectTeamStatus status,
            Long assignedMentorId,
            List<TeamMemberSnapshot> members
    ) {
    }

    private record TeamMemberSnapshot(Long memberId, String role) {
    }
}
