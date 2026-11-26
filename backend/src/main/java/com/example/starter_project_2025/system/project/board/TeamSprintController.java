package com.example.starter_project_2025.system.project.board;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/teams/{teamId}/sprints")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TeamSprintController {
    ProjectBoardService projectBoardService;

    @PostMapping
    public ResponseEntity<ProjectBoardSprintOption> create(
            @PathVariable Long teamId,
            @Valid @RequestBody TeamSprintCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(projectBoardService.createTeamSprint(teamId, request));
    }
}
