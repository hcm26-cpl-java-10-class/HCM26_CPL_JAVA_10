package com.example.starter_project_2025.system.project.team;

import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.dto.ProjectHubDtos;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;

import com.example.starter_project_2025.system.project.team.ProjectRole;
import com.example.starter_project_2025.system.project.team.ParticipationStatus;
import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/** Team Management writes the roster used by both allocation and Workspace. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TeamMembershipService {
    private final WorkspaceAccessService access;
    private final ProjectMemberRepository memberships;
    private final ClassMemberRepository classMembers;
    private final UserRepository users;

    private ProjectTeam authorizedTeam(Long id, boolean lock) {
        User actor = access.requireUser(false);
        access.requireTeamUpdate(actor);
        access.requireMemberRead(actor);
        access.requireTenant(actor, false);
        return access.requireTeam(actor, id, lock);
    }

    public List<ProjectHubDtos.ManagedMember> members(Long teamId) {
        authorizedTeam(teamId, false);
        return memberships.findAllByTeam_IdAndClassMember_StatusOrderByIdAsc(
                        teamId, ClassMemberStatus.ACTIVE).stream()
                .map(this::response).toList();
    }

    public List<ProjectHubDtos.MemberOption> options(Long teamId) {
        ProjectTeam team = authorizedTeam(teamId, false);
        return classMembers.findAllByTrainingClass_IdAndStatusOrderByIdAsc(
                        team.getTrainingClass().getId(), ClassMemberStatus.ACTIVE).stream()
                .map(ClassMember::getUser)
                .filter(user -> user.getTenant() != null
                        && user.getTenant().getId().equals(team.getTrainingClass().getTenantId()))
                .map(user -> new ProjectHubDtos.MemberOption(user.getId(), user.getUserCode(), user.getFullName()))
                .toList();
    }

    @Transactional
    public ProjectHubDtos.ManagedMember save(Long teamId, Long userId, ProjectHubDtos.MembershipUpdate request) {
        ProjectTeam team = authorizedTeam(teamId, true);
        User user = users.findById(userId).orElseThrow(() -> new ResponseStatusException(
                HttpStatus.UNPROCESSABLE_ENTITY, "Select an existing user in this class"));
        if (user.getTenant() == null
                || !user.getTenant().getId().equals(team.getTrainingClass().getTenantId())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "The member belongs to another tenant");
        }
        ClassMember classMember = classMembers.findByTrainingClass_IdAndUser_Id(
                        team.getTrainingClass().getId(), userId)
                .filter(member -> member.getStatus() == ClassMemberStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "Select an active member of this class"));
        if (request.status() != ParticipationStatus.ACTIVE) {
            memberships.findByTeam_IdAndClassMember_User_Id(teamId, userId)
                    .ifPresent(membership -> memberships.delete(membership));
            return new ProjectHubDtos.ManagedMember(userId, user.getUserCode(), user.getFullName(),
                    request.projectRole(), request.status());
        }
        if (!Boolean.TRUE.equals(user.getIsActive()) || Boolean.TRUE.equals(user.getLocked())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Select an active, unlocked user");
        }
        ProjectMember membership = memberships.findByTeam_IdAndClassMember_User_Id(teamId, userId)
                .orElseGet(() -> ProjectMember.builder().team(team).classMember(classMember).build());
        membership.setRole(request.projectRole().name());
        return response(memberships.saveAndFlush(membership));
    }

    private ProjectHubDtos.ManagedMember response(ProjectMember row) {
        ProjectRole role;
        try {
            role = row.getRole() == null ? ProjectRole.UNASSIGNED : ProjectRole.valueOf(row.getRole());
        } catch (IllegalArgumentException ignored) {
            role = ProjectRole.UNASSIGNED;
        }
        User user = row.getClassMember().getUser();
        return new ProjectHubDtos.ManagedMember(user.getId(), user.getUserCode(), user.getFullName(),
                role, ParticipationStatus.ACTIVE);
    }
}
