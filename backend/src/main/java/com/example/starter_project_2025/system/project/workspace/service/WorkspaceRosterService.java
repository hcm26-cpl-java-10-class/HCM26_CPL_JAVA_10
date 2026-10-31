package com.example.starter_project_2025.system.project.workspace.service;

import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectMemberRole;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceMemberResponse;
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
        return members.findAllByTeam_IdAndIsActiveTrueAndClassMember_TrainingClass_IdAndClassMember_User_Tenant_IdAndClassMember_StatusOrderByIdAsc(
                team.getId(), team.getTrainingClass().getId(), team.getTrainingClass().getTenantId(), ClassMemberStatus.ACTIVE);
    }

    public List<WorkspaceMemberResponse> response(List<ProjectMember> rows) {
        return rows.stream().map(row -> new WorkspaceMemberResponse(
                row.getClassMember().getUser().getUserCode(), row.getClassMember().getUser().getFullName(),
                ProjectMemberRole.parseRoles(row.getRole()))).toList();
    }
}
