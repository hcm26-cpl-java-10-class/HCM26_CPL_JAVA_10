package com.example.starter_project_2025.system.project.developmentinsights.controller;

import com.example.starter_project_2025.system.project.developmentinsights.dto.GitUnmappedActivityDtos;
import com.example.starter_project_2025.system.project.developmentinsights.service.GitUnmappedActivityService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/workspaces/{workspaceId}/git-activity/unmapped")
@PreAuthorize("hasAnyAuthority('WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
@RequiredArgsConstructor
public class GitUnmappedActivityController {
    private final GitUnmappedActivityService service;

    @GetMapping
    public GitUnmappedActivityDtos.UnmappedPage list(
            @PathVariable Long workspaceId,
            @RequestParam(defaultValue = "ALL") GitUnmappedActivityDtos.ActivityType type,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return service.list(workspaceId, type, from, to, search, page, size);
    }

    @GetMapping("/tasks")
    public GitUnmappedActivityDtos.TaskOptions tasks(@PathVariable Long workspaceId,
                                                      @RequestParam(required = false) Long projectId,
                                                      @RequestParam(required = false) String search) {
        return service.taskOptions(workspaceId, projectId, search);
    }

    @PostMapping("/links")
    public GitUnmappedActivityDtos.LinkResult link(@PathVariable Long workspaceId,
                                                    @Valid @RequestBody GitUnmappedActivityDtos.LinkInput input) {
        return service.link(workspaceId, input);
    }

}
