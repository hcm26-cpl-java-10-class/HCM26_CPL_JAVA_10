package com.example.starter_project_2025.system.project.team;

import com.example.starter_project_2025.system.project.sprint.SprintDTO;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogDTO;

import java.util.List;

/**
 * Read-only snapshot of the Backlog board of one team workspace.
 * <p>
 * The Backlog tab of a workspace must show only the sprints and work items that
 * belong to the team that owns the workspace: the sprints created for the team
 * ({@code sprint.team_id}) plus the sprints of the project the team works on,
 * and the product backlog of that project. The plain page endpoints of the
 * sprint / sprint backlog modules cannot express that "team <em>or</em>
 * project" scope, so the team board is served by a dedicated endpoint.
 *
 * @param teamId    team that owns the workspace
 * @param projectId project the team works on ({@code null} when the team has no
 *                  project yet)
 * @param sprints   sprints of the team workspace, oldest first
 * @param items     sprint backlog items of those sprints plus the product
 *                  backlog of the project
 */
public record TeamBacklogBoard(
        Long teamId,
        Long projectId,
        List<SprintDTO> sprints,
        List<SprintBacklogDTO> items,
        List<TeamBacklogMemberOption> members
) {
}
