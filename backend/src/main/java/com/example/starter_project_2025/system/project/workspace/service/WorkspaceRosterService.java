package com.example.starter_project_2025.system.project.workspace.service;

import com.example.starter_project_2025.system.project.team.ParticipationStatus;
import com.example.starter_project_2025.system.project.team.ProjectRole;
import com.example.starter_project_2025.system.project.team.Team;
import com.example.starter_project_2025.system.project.team.TeamMember;
import com.example.starter_project_2025.system.project.team.TeamMemberRepository;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceMemberResponse;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkspaceRosterService {
    private final TeamMemberRepository members;

    public List<TeamMember> current(Team team) {
        return members.findRoster(team.getId(), ParticipationStatus.ACTIVE);
    }

    public List<WorkspaceMemberResponse> response(List<TeamMember> rows) {
        return rows.stream().map(row -> new WorkspaceMemberResponse(
                row.getUser().getUserCode(), row.getUser().getFullName(),
                row.getProjectRole() == null ? ProjectRole.UNASSIGNED : row.getProjectRole(),
                row.getParticipationStatus())).toList();
    }
}
