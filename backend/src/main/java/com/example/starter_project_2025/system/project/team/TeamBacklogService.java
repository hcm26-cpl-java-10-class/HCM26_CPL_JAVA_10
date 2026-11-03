package com.example.starter_project_2025.system.project.team;

import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintMapper;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogDTO;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogMapper;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogService;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Reads the Backlog tab of a team workspace (sprints + work items of that team
 * only).
 * <p>
 * Scope of the read:
 * <ul>
 *   <li>sprints where {@code team_id} is the workspace team (created from the
 *       team board) <em>or</em> where {@code project_id} is the project the team
 *       works on (sprints planned for that project);</li>
 *   <li>work items of those sprints plus the product backlog (items without a
 *       sprint) of the team project.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TeamBacklogService {

    SprintRepository sprints;
    SprintBacklogRepository backlogs;
    SprintMapper sprintMapper;
    SprintBacklogMapper backlogMapper;
    WorkspaceAccessService workspaceAccess;
    ProjectMemberRepository projectMembers;
    SprintBacklogService sprintBacklogService;
    com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository workspaces;
    com.example.starter_project_2025.system.project.workspace.service.WorkspaceContextService contexts;
    com.example.starter_project_2025.system.project.workspace.service.WorkspaceProjectScope projectScope;
    com.example.starter_project_2025.system.project.resources.TeamSubprojectAssignmentRepository projectAssignments;

    @Transactional(readOnly = true)
    public TeamBacklogBoard read(Long teamId) {
        return read(teamId, null, null);
    }

    @Transactional(readOnly = true)
    public TeamBacklogBoard read(Long teamId, Long requestedProjectId, Long workspaceId) {
        User actor = workspaceAccess.requireUser(false);
        ProjectTeam team = workspaceAccess.requireTeam(actor, teamId, false);
        var workspace = workspaceId == null ? workspaces.findCurrentByTeamId(teamId).orElse(null)
                : contexts.require(actor, workspaceId);
        if (workspace != null && !workspace.getTeam().getId().equals(teamId))
            throw new org.springframework.security.access.AccessDeniedException("Workspace belongs to another team");
        List<Long> allowedProjects = workspace == null ? team.getProjectId() == null ? List.of() : List.of(team.getProjectId())
                : projectScope.projects(workspace).stream().map(com.example.starter_project_2025.system.project.domain.Project::getId).toList();
        if (requestedProjectId != null && !allowedProjects.contains(requestedProjectId))
            throw new org.springframework.security.access.AccessDeniedException("The selected project is outside this workspace");
        List<Long> selectedProjects = requestedProjectId == null ? allowedProjects : List.of(requestedProjectId);
        Long projectId = requestedProjectId != null ? requestedProjectId : workspace != null && workspace.getProject() != null
                ? workspace.getProject().getId() : team.getProjectId();
        boolean includeTeamOnly = workspace == null || workspace.getProject() == null || workspace.getProject().getAssignmentId() == null;
        Map<Long, Sprint> sprintRows = new java.util.LinkedHashMap<>();
        if (includeTeamOnly) sprints.findActiveByTeamIdOrderByIdAsc(teamId).stream()
                .filter(sprint -> sprint.getProjectId() == null || selectedProjects.contains(sprint.getProjectId()))
                .forEach(sprint -> sprintRows.put(sprint.getId(), sprint));
        if (!selectedProjects.isEmpty()) sprints.findAllByProjectIdInAndIsActiveTrueOrderByIdAsc(selectedProjects)
                .forEach(sprint -> sprintRows.put(sprint.getId(), sprint));
        List<Sprint> teamSprints = new ArrayList<>(sprintRows.values());
        Map<Long, SprintBacklog> itemRows = new java.util.LinkedHashMap<>();
        if (includeTeamOnly) backlogs.findActiveBySprintTeamId(teamId).stream()
                .filter(item -> item.getProjectId() == null && (item.getSprint() == null || item.getSprint().getProjectId() == null)
                        || selectedProjects.contains(item.getProjectId()))
                .forEach(item -> itemRows.put(item.getId(), item));
        if (!selectedProjects.isEmpty()) backlogs.findAllByProjectIdInAndIsActiveTrueOrderByIdAsc(selectedProjects)
                .forEach(item -> itemRows.put(item.getId(), item));
        List<SprintBacklog> items = new ArrayList<>(itemRows.values());
        if (!selectedProjects.isEmpty()) {
            Set<String> sprintItemKeys = items.stream()
                    .filter(item -> item.getSprint() != null)
                    .map(TeamBacklogService::workItemKey)
                    .collect(Collectors.toSet());
            Set<String> productItemKeys = new HashSet<>();
            items.removeIf(item -> item.getSprint() == null && sprintItemKeys.contains(workItemKey(item)));
            items.removeIf(item -> item.getSprint() == null && !productItemKeys.add(workItemKey(item)));
        }
        items.sort(Comparator.comparing(SprintBacklog::getId));

        List<ProjectMember> activeMembers = projectMembers
                .findAllByTeam_IdAndClassMember_StatusOrderByIdAsc(teamId, ClassMemberStatus.ACTIVE);
        // Preserve the name on existing assignments even when a member becomes
        // unavailable for new assignments. Only active members remain selectable.
        Map<Long, String> assigneeNames = projectMembers.findAllByTeam_IdOrderByIdAsc(teamId).stream().collect(Collectors.toMap(
                        ProjectMember::getId,
                        TeamBacklogService::displayName,
                        (first, ignored) -> first
                ));
        List<TeamBacklogMemberOption> memberOptions = activeMembers.stream()
                .filter(TeamBacklogService::eligibleMember)
                .map(member -> new TeamBacklogMemberOption(member.getId(), displayName(member)))
                .toList();
        List<SprintBacklogDTO> itemDtos = items.stream().map(backlogMapper::toResponse).toList();
        itemDtos.forEach(item -> item.setAssigneeDisplayName(assigneeNames.get(item.getAssigneeProjectMemberId())));

        return new TeamBacklogBoard(
                teamId,
                projectId,
                teamSprints.stream().map(sprintMapper::toResponse).toList(),
                itemDtos,
                memberOptions
        );
    }

    @Transactional
    public SprintBacklogDTO assign(Long teamId, Long itemId, Long projectMemberId) {
        User actor = workspaceAccess.requireUser(false);
        ProjectTeam team = workspaceAccess.requireTeam(actor, teamId, false);
        if (!workspaceAccess.permitted(actor, "SPRINT_BACKLOG_UPDATE")) {
            throw new org.springframework.security.access.AccessDeniedException("Work item update is not allowed");
        }

        SprintBacklog item = backlogs.findById(itemId)
                .filter(row -> Boolean.TRUE.equals(row.getIsActive()))
                .orElseThrow(() -> new com.example.starter_project_2025.exception.ResourceNotFoundException("Sprint Backlog", "id", itemId));
        Long teamProjectId = team.getProjectId();
        boolean assignedToTeam = item.getProjectId() != null && projectAssignments
                .existsByTeam_IdAndProject_IdAndIsActiveTrue(teamId, item.getProjectId());
        boolean inTeamBoard = assignedToTeam || (item.getSprint() != null
                ? (teamId.equals(item.getSprint().getTeamId()))
                    || (teamProjectId != null && teamProjectId.equals(item.getProjectId()))
                : teamProjectId != null && teamProjectId.equals(item.getProjectId()));
        if (!inTeamBoard) {
            throw new org.springframework.security.access.AccessDeniedException("Work item is outside this workspace");
        }
        if (projectMemberId != null && projectMembers.findAllByTeam_IdAndClassMember_StatusOrderByIdAsc(
                        teamId, ClassMemberStatus.ACTIVE).stream()
                .noneMatch(member -> projectMemberId.equals(member.getId()) && eligibleMember(member))) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY,
                    "Assignee must be an active member of this workspace team");
        }

        SprintBacklogDTO update = SprintBacklogDTO.builder()
                .assigneeProjectMemberId(projectMemberId)
                .clearAssignee(projectMemberId == null)
                .build();
        return sprintBacklogService.update(itemId, update);
    }

    private static String displayName(ProjectMember member) {
        var user = member.getClassMember().getUser();
        return (user.getFirstName() + " " + (user.getLastName() == null ? "" : user.getLastName())).trim();
    }

    private static String workItemKey(SprintBacklog item) {
        return item.getProjectId() + "\u0000" + normalize(item.getTitle()) + "\u0000" + normalize(item.getDescription());
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private static boolean eligibleMember(ProjectMember member) {
        var user = member.getClassMember().getUser();
        return Boolean.TRUE.equals(user.getIsActive()) && !Boolean.TRUE.equals(user.getLocked());
    }
}
