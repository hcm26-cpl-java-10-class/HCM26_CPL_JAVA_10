package com.example.starter_project_2025.system.project.board;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/teams/{teamId}/sprints/{sprintId}/board")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TeamBoardController {
    ProjectBoardService projectBoardService;

    @GetMapping
    public ResponseEntity<ProjectBoardResponse> getBoard(
            @PathVariable Long teamId,
            @PathVariable Long sprintId
    ) {
        return ResponseEntity.ok(projectBoardService.getTeamBoard(teamId, sprintId));
    }
}
