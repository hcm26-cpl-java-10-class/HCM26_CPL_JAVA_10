package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProjectTeamQueryService {

    private final TeamAllocationSessionRepository sessionRepository;
    private final ProjectTeamRepository teamRepository;
    private final ProjectMemberRepository memberRepository;
    private final ScopeAuthorizationService scopeAuthorizationService;
    private final ProjectTeamMentorService teamMentorService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public BatchSaveDraftResponse getTeams(
            Long classId,
            Long sessionId,
            Authentication authentication
    ) {
        TeamAllocationSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TeamAllocationSession", "id", sessionId));
        if (!session.getTrainingClass().getId().equals(classId)) {
            throw new ResourceNotFoundException("TeamAllocationSession", "classId", classId);
        }
        scopeAuthorizationService.assertCanManageTeamMentor(
                authentication, session.getTrainingClass());

        List<ProjectTeam> teams =
                teamRepository.findAllByAllocationSession_IdOrderByIdAsc(sessionId);
        Map<Long, List<ProjectMember>> assignmentsByTeam = new HashMap<>();
        for (ProjectTeam team : teams) {
            assignmentsByTeam.put(
                    team.getId(),
                    memberRepository.findAllByTeam_IdOrderByIdAsc(team.getId()));
        }

        List<BatchSaveDraftResponse.TeamResponse> teamResponses = teams.stream()
                .map(team -> {
                    List<ProjectMember> assignments =
                            assignmentsByTeam.getOrDefault(team.getId(), List.of());
                    List<Long> memberIds = assignments.stream()
                    .map(member -> member.getClassMember().getId())
                    .toList();
                    List<BatchSaveDraftResponse.MemberResponse> members =
                            assignments.stream()
                                    .map(member -> new BatchSaveDraftResponse.MemberResponse(
                                            member.getClassMember().getId(),
                                            member.getClassMember().getUser().getFullName(),
                                            member.getRole(),
                                            ProjectMemberRole.parseRoles(member.getRole())))
                                    .toList();
                    ProjectTemplateConstraints.Capacity capacity =
                            readTemplateCapacity(team);
                    ProjectTemplateConstraints.RolePolicy policy =
                            readTemplatePolicy(team);
                    return new BatchSaveDraftResponse.TeamResponse(
                        team.getId(),
                        team.getTeamName(),
                        team.getStatus(),
                        team.getAssignedMentorId(),
                        teamMentorService.getMentorName(team.getAssignedMentorId()),
                        team.getVersion(),
                        memberIds,
                        members,
                        team.getProjectTemplateId(),
                        team.getProjectTemplateName(),
                        capacity == null ? null : capacity.minMembers(),
                        capacity == null ? null : capacity.maxMembers(),
                        memberIds.size(),
                        policy.allowMultiRole(),
                        policy.quotas()
                    );
                })
                .toList();
        return new BatchSaveDraftResponse(
                "SUCCESS", sessionId, teamResponses, List.of());
    }

    private ProjectTemplateConstraints.Capacity readTemplateCapacity(ProjectTeam team) {
        ProjectTemplate template = team.getProjectTemplate();
        if (template == null) {
            return null;
        }
        try {
            return ProjectTemplateConstraints.parse(objectMapper, template, null);
        } catch (RuntimeException ignored) {
            // Broken constraints must not break the team list; the assign
            // action surfaces them with a 400.
            return null;
        }
    }

    private ProjectTemplateConstraints.RolePolicy readTemplatePolicy(ProjectTeam team) {
        ProjectTemplate template = team.getProjectTemplate();
        if (template == null) {
            return ProjectTemplateConstraints.RolePolicy.singleRoleDefault();
        }
        try {
            return ProjectTemplateConstraints.parseRolePolicy(objectMapper, template);
        } catch (RuntimeException ignored) {
            return ProjectTemplateConstraints.RolePolicy.singleRoleDefault();
        }
    }
}
