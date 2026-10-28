package com.example.starter_project_2025.system.project.team;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.ProjectTeamStatus;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintMapper;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogMapper;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

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

    ProjectTeamRepository teams;
    SprintRepository sprints;
    SprintBacklogRepository backlogs;
    SprintMapper sprintMapper;
    SprintBacklogMapper backlogMapper;

    /**
     * @throws ResponseStatusException 404 when the team does not exist in the
     *                                tenant of the caller
     * @throws AccessDeniedException   when the request is not authenticated
     */
    @Transactional(readOnly = true)
    public TeamBacklogBoard read(Long teamId) {
        User actor = requireActor();

        ProjectTeam team = teams.findByIdAndTrainingClass_TenantId(teamId, actor.getTenantId())
                .filter(candidate -> Boolean.TRUE.equals(candidate.getIsActive())
                        && candidate.getStatus() == ProjectTeamStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Team was not found"));

        Long projectId = team.getProjectId();

        List<Sprint> teamSprints = projectId == null
                ? sprints.findActiveByTeamIdOrderByIdAsc(teamId)
                : sprints.findActiveByTeamIdOrProjectIdOrderByIdAsc(teamId, projectId);

        List<SprintBacklog> items = new ArrayList<>(projectId == null
                ? backlogs.findActiveBySprintTeamId(teamId)
                : backlogs.findActiveBySprintTeamIdOrProjectId(teamId, projectId));
        if (projectId != null) {
            items.addAll(backlogs.findProductBacklogByProjectId(projectId));
        }
        items.sort(Comparator.comparing(SprintBacklog::getId));

        return new TeamBacklogBoard(
                teamId,
                projectId,
                teamSprints.stream().map(sprintMapper::toResponse).toList(),
                items.stream().map(backlogMapper::toResponse).toList()
        );
    }

    private User requireActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            throw new AccessDeniedException("Authentication is required to view the team backlog");
        }

        if (!(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new AccessDeniedException("Authenticated user context is unavailable");
        }

        return principal.getUser();
    }
}
