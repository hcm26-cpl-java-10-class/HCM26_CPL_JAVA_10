package com.example.starter_project_2025.system.project.milestone.submission.controller;

import com.example.starter_project_2025.system.project.milestone.submission.dto.SubmissionDtos;
import com.example.starter_project_2025.system.project.milestone.submission.service.ProjectCompletionCommandService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/projects/{projectId}/teams/{teamId}")
@RequiredArgsConstructor
public class ProjectCompletionController {
    private final ProjectCompletionCommandService commands;
    private final com.example.starter_project_2025.system.project.milestone.submission.service.ProjectCompletionQueryService queries;

    @GetMapping("/completion")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyAuthority('WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE', 'MILESTONE_READ')")
    public com.example.starter_project_2025.system.project.milestone.submission.service.ProjectCompletionQueryService.Summary summary(
            @PathVariable Long projectId, @PathVariable Long teamId) {
        return queries.get(projectId, teamId);
    }

    @PostMapping("/final-grade/lock")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyAuthority('MILESTONE_WRITE', 'PRJ_WORKSPACE_MANAGE')")
    public SubmissionDtos.ProjectCompletionResult lockFinalGrade(
            @PathVariable Long projectId, @PathVariable Long teamId,
            @Valid @RequestBody SubmissionDtos.LockFinalGradeRequest request) {
        return commands.lockFinalGrade(projectId, teamId, request);
    }

    @PostMapping("/milestones/{milestoneId}/waive")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyAuthority('MILESTONE_WRITE', 'PRJ_WORKSPACE_MANAGE')")
    public SubmissionDtos.ProjectCompletionResult waiveMilestone(
            @PathVariable Long projectId, @PathVariable Long teamId, @PathVariable UUID milestoneId,
            @Valid @RequestBody SubmissionDtos.WaiveMilestoneRequest request) {
        return commands.waive(projectId, teamId, milestoneId, request);
    }
}
