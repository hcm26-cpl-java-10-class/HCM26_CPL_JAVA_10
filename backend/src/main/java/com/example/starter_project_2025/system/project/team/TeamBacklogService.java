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

    @Transactional(readOnly = true)
    public TeamBacklogBoard read(Long teamId) {
        User actor = workspaceAccess.requireUser(false);
        ProjectTeam team = workspaceAccess.requireTeam(actor, teamId, false);

        Long projectId = team.getProjectId();

        List<Sprint> teamSprints = projectId == null
                ? sprints.findActiveByTeamIdOrderByIdAsc(teamId)
                : sprints.findActiveByTeamIdOrProjectIdOrderByIdAsc(teamId, projectId);

        List<SprintBacklog> items = new ArrayList<>(projectId == null
                ? backlogs.findActiveBySprintTeamId(teamId)
                : backlogs.findActiveBySprintTeamIdOrProjectId(teamId, projectId));
        if (projectId != null) {
            Set<String> sprintItemKeys = items.stream()
                    .filter(item -> item.getSprint() != null)
                    .map(TeamBacklogService::workItemKey)
                    .collect(Collectors.toSet());
            Set<String> productItemKeys = new HashSet<>();
            backlogs.findProductBacklogByProjectId(projectId).stream()
                    // A product-backlog row can be left behind when its work
                    // item was moved into a sprint. Prefer the sprint row,
                    // which carries the current workflow state and history.
                    .filter(item -> !sprintItemKeys.contains(workItemKey(item)))
                    // Old demo databases may also contain duplicate product
                    // backlog rows. Keep the first (lowest-id) copy returned
                    // by the repository; exact title + description identity
                    // avoids collapsing distinct work that merely shares a title.
                    .filter(item -> productItemKeys.add(workItemKey(item)))
                    .forEach(items::add);
        }
        items.sort(Comparator.comparing(SprintBacklog::getId));

        List<ProjectMember> activeMembers = projectMembers
                .findAllByTeam_IdAndClassMember_StatusOrderByIdAsc(teamId, ClassMemberStatus.ACTIVE);
        Map<Long, String> assigneeNames = activeMembers.stream().collect(Collectors.toMap(
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
        boolean inTeamBoard = item.getSprint() != null
                ? (teamId.equals(item.getSprint().getTeamId()))
                    || (teamProjectId != null && teamProjectId.equals(item.getProjectId()))
                : teamProjectId != null && teamProjectId.equals(item.getProjectId());
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
        return normalize(item.getTitle()) + "\u0000" + normalize(item.getDescription());
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private static boolean eligibleMember(ProjectMember member) {
        var user = member.getClassMember().getUser();
        return Boolean.TRUE.equals(user.getIsActive()) && !Boolean.TRUE.equals(user.getLocked());
    }
}
