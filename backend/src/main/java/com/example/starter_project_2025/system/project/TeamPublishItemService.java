package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.web.CorrelationIdFilter;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.template.assignment.TemplateAssignmentProvisioningService;
import com.example.starter_project_2025.system.project.template.assignment.hierarchy.ProjectAssignmentService;
import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceStatus;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
    private final ProjectRepository projectRepository;
    private final WorkspaceRepository workspaceRepository;
    private final ObjectMapper objectMapper;
    private final ProjectTeamMentorService teamMentorService;
    private final ProjectTeamMemberHistoryService historyService;
    private final TemplateAssignmentProvisioningService provisioning;
    private final ProjectAssignmentService projectAssignments;

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
            if (team.getProject() != null && team.getProject().getStatus() == ProjectStatus.PLANNING) {
                activateProjectAndWorkspace(team);
            }
            return;
        }
        if (session.getStatus() != TeamAllocationSessionStatus.OPEN) {
            throw new TeamPublishValidationException("Allocation session is not open");
        }
        if (team.getStatus() != ProjectTeamStatus.DRAFT) {
            throw new TeamPublishValidationException("Only DRAFT teams can be published");
        }

        projectAssignments.validateDirectAssignmentPublication(team);
        Long assignedMentorId = teamMentorService.resolveMentorForPublish(team);
        List<ProjectMember> assignments = memberRepository.findAllByTeam_IdOrderByIdAsc(teamId);
        if (assignments.isEmpty()) {
            throw new TeamPublishValidationException(
                    "A team without members cannot be published");
        }
        if (ProjectTeamLeaderService.activeLeaderId(team, assignments) == null) {
            throw new TeamPublishValidationException("Chọn một thành viên ACTIVE làm Leader trước khi công bố nhóm.");
        }
        assignments.forEach(assignment -> {
            if (assignment.getRole() == null || assignment.getRole().isBlank()) {
                assignment.setRole(ProjectMemberRole.DEV.name());
            }
        });
        if (assignments.stream().anyMatch(assignment ->
                !ProjectMemberRole.isValidSpec(assignment.getRole()))) {
            throw new TeamPublishValidationException(
                    "Mỗi thành viên cần được gán một vai trò hợp lệ trước khi publish");
        }
        validateTemplateRolePolicy(team, assignments);

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
            List<Long> conflictMemberIds = activeConflicts.stream()
                    .map(conflict -> conflict.getClassMember().getId())
                    .distinct()
                    .toList();
            List<String> conflictNames = activeConflicts.stream()
                    .map(conflict -> conflict.getClassMember().getUser().getFullName())
                    .distinct()
                    .toList();
            throw new StudentAlreadyAssignedException(
                    conflictMemberIds,
                    activeConflicts.get(0).getTeam().getId(),
                    conflictNames);
        }

        String beforeState = serialize(snapshot(team, assignments, ProjectTeamStatus.DRAFT));
        team.setAssignedMentorId(assignedMentorId);
        team.setStatus(ProjectTeamStatus.ACTIVE);
        teamRepository.saveAndFlush(team);
        if (team.getProjectTemplate() != null) {
            provisioning.provision(team, team.getProjectTemplate(), actorId, CorrelationIdFilter.currentId());
        }
        activateProjectAndWorkspace(team);
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

    /**
     * The project/workspace provisioned for a DRAFT team are created as
     * PLANNING / DRAFT. They become ACTIVE only when the team is published.
     */
    private void activateProjectAndWorkspace(ProjectTeam team) {
        Project project = team.getProject();
        if (project == null) {
            return;
        }
        project.setStatus(ProjectStatus.ACTIVE);
        projectRepository.saveAndFlush(project);

        Workspace workspace = workspaceRepository.findCurrentByTeamId(team.getId()).orElse(null);
        if (workspace == null
                || workspace.getStatus() == WorkspaceStatus.ARCHIVED
                || workspace.getStatus() == WorkspaceStatus.CLOSED) {
            return;
        }
        workspace.setStatus(WorkspaceStatus.ACTIVE);
        workspaceRepository.saveAndFlush(workspace);
    }

    /** US-11: publishing also enforces the template role quotas. */
    private void validateTemplateRolePolicy(
            ProjectTeam team,
            List<ProjectMember> assignments
    ) {
        ProjectTemplate template = ProjectTemplateConstraints.templateFor(team);
        if (template == null) {
            return;
        }
        ProjectTemplateConstraints.RolePolicy policy;
        try {
            policy = ProjectTemplateConstraints.parseRolePolicy(objectMapper, template);
        } catch (RuntimeException ignored) {
            return;
        }

        Map<String, Integer> counts = new HashMap<>();
        for (ProjectMember assignment : assignments) {
            ProjectMemberRole.parseRoles(assignment.getRole())
                    .forEach(role -> counts.merge(role, 1, Integer::sum));
        }
        if (!policy.allowMultiRole() && assignments.stream()
                .anyMatch(assignment ->
                        ProjectMemberRole.parseRoles(assignment.getRole()).size() > 1)) {
            throw new TeamPublishValidationException(
                    "Đề bài dự án không cho phép kiêm nhiệm vai trò. "
                            + "Mỗi thành viên chỉ được đảm nhận đúng 1 vai trò.");
        }
        List<String> missing = policy.quotas().stream()
                .filter(quota -> counts.getOrDefault(quota.role(), 0) < quota.min())
                .map(quota -> quota.role() + " (cần tối thiểu " + quota.min() + ")")
                .toList();
        if (!missing.isEmpty()) {
            throw new TeamPublishValidationException(
                    "Cấu hình vai trò chưa đáp ứng định suất của đề bài. "
                            + "Còn thiếu vai trò bắt buộc: " + String.join(", ", missing));
        }
        List<String> exceeded = policy.quotas().stream()
                .filter(quota -> counts.getOrDefault(quota.role(), 0) > quota.max())
                .map(quota -> quota.role() + " (tối đa " + quota.max() + ")")
                .toList();
        if (!exceeded.isEmpty()) {
            throw new TeamPublishValidationException("Vượt định suất vai trò: " + String.join(", ", exceeded));
        }
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
