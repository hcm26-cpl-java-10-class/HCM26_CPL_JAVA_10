package com.example.starter_project_2025.system.project.board;

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

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/projects")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Project Board", description = "Project and sprint choices for the Board screen")
public class ProjectBoardOptionsController {

    ProjectBoardService projectBoardService;

    @GetMapping("/board-options")
    @Operation(summary = "List projects available to the current user for Board")
    public ResponseEntity<List<ProjectBoardProjectOption>> getAccessibleProjects() {
        return ResponseEntity.ok(projectBoardService.getAccessibleProjects());
    }

    @GetMapping("/{projectId}/board-sprints")
    @Operation(summary = "List sprints available in a project for Board")
    public ResponseEntity<List<ProjectBoardSprintOption>> getProjectSprints(
            @PathVariable Long projectId
    ) {
        return ResponseEntity.ok(projectBoardService.getProjectSprints(projectId));
    }
}
