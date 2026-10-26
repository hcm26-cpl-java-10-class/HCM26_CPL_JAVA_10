package com.example.starter_project_2025.system.project.workspace.service;

import com.example.starter_project_2025.system.project.team.ParticipationStatus;
import com.example.starter_project_2025.system.project.team.ProjectRole;
import com.example.starter_project_2025.system.project.team.Team;
import com.example.starter_project_2025.system.project.team.TeamMember;
import com.example.starter_project_2025.system.project.team.TeamMemberRepository;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceMemberResponse;

import com.example.starter_project_2025.system.project.team.ParticipationStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkspaceRosterService {
    private final ProjectMemberRepository members;

    public List<ProjectMember> current(ProjectTeam team) {
        return members.findAllByTeam_IdAndClassMember_StatusOrderByIdAsc(
                team.getId(), com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus.ACTIVE);
    }

    public List<WorkspaceMemberResponse> response(List<ProjectMember> rows) {
        return rows.stream().map(row -> new WorkspaceMemberResponse(
                row.getClassMember().getUser().getUserCode(), row.getClassMember().getUser().getFullName(),
                toProjectRole(row.getRole()), ParticipationStatus.ACTIVE)).toList();
    }

    private com.example.starter_project_2025.system.project.team.ProjectRole toProjectRole(String role) {
        if (role == null) {
            return com.example.starter_project_2025.system.project.team.ProjectRole.UNASSIGNED;
        }
        try {
            return com.example.starter_project_2025.system.project.team.ProjectRole.valueOf(role);
        } catch (IllegalArgumentException ignored) {
            return com.example.starter_project_2025.system.project.team.ProjectRole.UNASSIGNED;
        }
    }
}
