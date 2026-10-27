package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
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
                                            member.getRole()))
                                    .toList();
                    return new BatchSaveDraftResponse.TeamResponse(
                        team.getId(),
                        team.getTeamName(),
                        team.getStatus(),
                        team.getAssignedMentorId(),
                        teamMentorService.getMentorName(team.getAssignedMentorId()),
                        team.getVersion(),
                        memberIds,
                        members
                    );
                })
                .toList();
        return new BatchSaveDraftResponse(
                "SUCCESS", sessionId, teamResponses, List.of());
    }
}
