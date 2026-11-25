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

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/projects/{projectId}/sprints/{sprintId}/board")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Project Board", description = "Read-only sprint board and activity feed")
public class ProjectBoardController {

    ProjectBoardService projectBoardService;

    @GetMapping
    @Operation(
            operationId = "getProjectSprintBoard",
            summary = "Get a project's sprint board",
            description = "UFR-PRJ-005-01. Reads backlog, sprint tasks and project activity within the caller's tenant and project scope."
    )
    public ResponseEntity<ProjectBoardResponse> getBoard(
            @PathVariable Long projectId,
            @PathVariable Long sprintId
    ) {
        return ResponseEntity.ok(projectBoardService.getBoard(projectId, sprintId));
    }
}
