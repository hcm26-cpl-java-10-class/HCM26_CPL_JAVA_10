package com.example.starter_project_2025.system.project.team;

import com.example.starter_project_2025.system.project.dto.ProjectHubDtos;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;

import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

/** Team Management owns roster writes; Workspace GET endpoints remain read-only. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TeamMembershipService {
    private final WorkspaceAccessService access;
    private final TeamMemberRepository memberships;
    private final UserRepository users;

    private Team authorizedTeam(Long id, boolean lock) {
        User actor = access.requireUser(false);
        access.requireTeamUpdate(actor);
        access.requireMemberRead(actor);
        access.requireTenant(actor, false);
        return access.requireTeam(actor, id, lock);
    }

    public List<ProjectHubDtos.ManagedMember> members(Long teamId) {
        Team team = authorizedTeam(teamId, false);
        return memberships.findManagedRoster(teamId).stream()
                .filter(row -> row.getUser().getTenant() != null
                        && row.getUser().getTenant().getId().equals(team.getTenant().getId()))
                .map(this::response).toList();
    }

    public List<ProjectHubDtos.MemberOption> options(Long teamId) {
        Team team = authorizedTeam(teamId, false);
        return users.findByTenantIdAndIsActiveTrue(team.getTenant().getId()).stream()
                .filter(user -> !Boolean.TRUE.equals(user.getLocked()))
                .map(user -> new ProjectHubDtos.MemberOption(user.getId(), user.getUserCode(), user.getFullName()))
                .toList();
    }

    @Transactional
    public ProjectHubDtos.ManagedMember save(Long teamId, Long userId, ProjectHubDtos.MembershipUpdate request) {
        Team team = authorizedTeam(teamId, true);
        User user = users.findById(userId).orElseThrow(() -> new ResponseStatusException(
                HttpStatus.UNPROCESSABLE_ENTITY, "Select an existing user in this tenant"));
        if (user.getTenant() == null || !user.getTenant().getId().equals(team.getTenant().getId()))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "The member belongs to another tenant");
        if (request.status() == ParticipationStatus.ACTIVE
                && (!Boolean.TRUE.equals(user.getIsActive()) || Boolean.TRUE.equals(user.getLocked())))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Select an active, unlocked user");
        TeamMember membership = memberships.findByTeamIdAndUserId(teamId, userId).orElseGet(() -> {
            TeamMember created = new TeamMember(); created.setTeam(team); created.setUser(user); return created;
        });
        users.lockForContribution(java.util.List.of(userId));
        if (request.status() == ParticipationStatus.ACTIVE && !membership.isCurrentParticipant())
            membership.setJoinedAt(java.time.Instant.now());
        membership.setIsActive(true);
        membership.setProjectRole(request.projectRole());
        membership.setParticipationStatus(request.status());
        return response(memberships.saveAndFlush(membership));
    }

    private ProjectHubDtos.ManagedMember response(TeamMember row) {
        return new ProjectHubDtos.ManagedMember(row.getUser().getId(), row.getUser().getUserCode(),
                row.getUser().getFullName(), row.getProjectRole() == null ? ProjectRole.UNASSIGNED : row.getProjectRole(),
                row.getParticipationStatus());
    }
}
