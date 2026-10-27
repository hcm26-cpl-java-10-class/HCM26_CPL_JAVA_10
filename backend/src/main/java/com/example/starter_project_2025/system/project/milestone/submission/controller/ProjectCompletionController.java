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

    @PostMapping("/final-grade/lock")
    public SubmissionDtos.ProjectCompletionResult lockFinalGrade(
            @PathVariable Long projectId, @PathVariable Long teamId,
            @Valid @RequestBody SubmissionDtos.LockFinalGradeRequest request) {
        return commands.lockFinalGrade(projectId, teamId, request);
    }

    @PostMapping("/milestones/{milestoneId}/waive")
    public SubmissionDtos.ProjectCompletionResult waiveMilestone(
            @PathVariable Long projectId, @PathVariable Long teamId, @PathVariable UUID milestoneId,
            @Valid @RequestBody SubmissionDtos.WaiveMilestoneRequest request) {
        return commands.waive(projectId, teamId, milestoneId, request);
    }
}
