package com.example.starter_project_2025.system.project;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import static com.example.starter_project_2025.system.project.WorkspaceSectionDtos.*;

@RestController @RequiredArgsConstructor
@RequestMapping("/api/workspaces/{id}")
@PreAuthorize("hasAnyAuthority('WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
public class WorkspaceSectionsController {
    private final WorkspaceSectionService service;
    @GetMapping("/sections") public Navigation navigation(@PathVariable Long id) { return service.navigation(id); }

    @GetMapping({"/milestones", "/sprints", "/backlog", "/artifacts", "/feedback", "/activity"})
    public Content read(@PathVariable Long id, jakarta.servlet.http.HttpServletRequest request) {
        String path = request.getRequestURI();
        return service.read(id, path.substring(path.lastIndexOf('/') + 1));
    }
    @PostMapping("/milestones") @ResponseStatus(HttpStatus.CREATED)
    public Item milestone(@PathVariable Long id, @Valid @RequestBody Create request) {
        return service.create(id, WorkspaceSection.MILESTONE, request);
    }
    @PostMapping("/sprints") @ResponseStatus(HttpStatus.CREATED)
    public Item sprint(@PathVariable Long id, @Valid @RequestBody Create request) {
        return service.create(id, WorkspaceSection.SPRINT, request);
    }
    @PostMapping("/tasks") @ResponseStatus(HttpStatus.CREATED)
    public Item task(@PathVariable Long id, @Valid @RequestBody Create request) {
        return service.task(id, request, null);
    }
    @PutMapping("/tasks/{taskId}")
    public Item updateTask(@PathVariable Long id, @PathVariable String taskId, @Valid @RequestBody Create request) {
        return service.task(id, request, taskId);
    }
    @PostMapping("/artifacts") @ResponseStatus(HttpStatus.CREATED)
    public Item artifact(@PathVariable Long id, @Valid @RequestBody Create request) {
        return service.create(id, WorkspaceSection.ARTIFACT, request);
    }
    @PostMapping("/artifacts/submit") @ResponseStatus(HttpStatus.CREATED)
    public Item submit(@PathVariable Long id, @Valid @RequestBody Create request) { return service.submit(id, request); }

    @PostMapping("/feedback") @ResponseStatus(HttpStatus.CREATED)
    public Item feedback(@PathVariable Long id, @Valid @RequestBody Create request) {
        return service.create(id, WorkspaceSection.FEEDBACK, request);
    }
    @PostMapping("/reviews") @ResponseStatus(HttpStatus.CREATED)
    public Item review(@PathVariable Long id, @Valid @RequestBody Review request) { return service.review(id, request); }
}
