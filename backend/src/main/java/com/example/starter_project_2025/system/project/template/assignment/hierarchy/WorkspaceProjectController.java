package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/workspaces/{workspaceId}/project-hierarchy")
@PreAuthorize("hasAnyAuthority('WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
public class WorkspaceProjectController {
    private final WorkspaceHierarchyService service;

    @GetMapping
    public ResponseEntity<WorkspaceHierarchyService.Context> get(@PathVariable Long workspaceId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.get(workspaceId));
    }
}
