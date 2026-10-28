package com.example.starter_project_2025.system.project.team;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Backlog board of one team workspace.
 * <p>
 * The generic sprint / sprint backlog page endpoints list every record of the
 * tenant, which is wrong for the Backlog tab of a workspace: opening
 * {@code /management/workspaces/:id?tab=backlog} must only show the sprints and
 * work items of that workspace team.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/teams/{teamId}/backlog-board")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Team Backlog", description = "APIs for the backlog board of a team workspace")
public class TeamBacklogController {

    TeamBacklogService teamBacklogService;

    @GetMapping
    @Operation(summary = "Sprints and work items that belong to one team workspace")
    public ResponseEntity<TeamBacklogBoard> getBoard(@PathVariable Long teamId) {
        return ResponseEntity.ok(teamBacklogService.read(teamId));
    }
}
