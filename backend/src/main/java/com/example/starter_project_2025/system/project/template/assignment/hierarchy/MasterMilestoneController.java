package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import com.example.starter_project_2025.system.project.milestone.submission.dto.SubmissionDtos;
import com.example.starter_project_2025.system.project.milestone.submission.service.ProjectCompletionCommandService;
import com.example.starter_project_2025.system.project.milestone.submission.service.ProjectCompletionQueryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class MasterMilestoneController {
    private final MasterMilestoneService milestones;
    private final ProjectCompletionQueryService completion;
    private final ProjectCompletionCommandService commands;

    @GetMapping("/api/projects/{projectId}/master-milestones")
    @PreAuthorize("hasAnyAuthority('MILESTONE_WRITE', 'PRJ_WORKSPACE_MANAGE')")
    public ResponseEntity<MasterMilestoneService.Context> getForClass(@PathVariable Long projectId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(milestones.getForClass(projectId));
    }

    @PostMapping("/api/projects/{projectId}/master-milestones/{milestoneId}/submissions")
    @PreAuthorize("hasAnyAuthority('MILESTONE_WRITE', 'PRJ_WORKSPACE_MANAGE')")
    public SubmissionDtos.Detail submitForClass(@PathVariable Long projectId, @PathVariable UUID milestoneId,
            @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody MasterMilestoneService.Submit request) {
        return milestones.submitForClass(projectId, milestoneId, key, request);
    }

    @GetMapping("/api/workspaces/{workspaceId}/master-milestones")
    @PreAuthorize("hasAnyAuthority('WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
    public ResponseEntity<MasterMilestoneService.Context> get(@PathVariable Long workspaceId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(milestones.get(workspaceId));
    }

    @PostMapping("/api/workspaces/{workspaceId}/master-milestones/{milestoneId}/submissions")
    @PreAuthorize("hasAnyAuthority('MILESTONE_WRITE', 'PRJ_WORKSPACE_MANAGE')")
    public SubmissionDtos.Detail submit(@PathVariable Long workspaceId, @PathVariable UUID milestoneId,
            @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody MasterMilestoneService.Submit request) {
        return milestones.submit(workspaceId, milestoneId, key, request);
    }

    @GetMapping("/api/projects/{projectId}/completion")
    @PreAuthorize("hasAnyAuthority('MILESTONE_WRITE', 'PRJ_WORKSPACE_MANAGE')")
    public ProjectCompletionQueryService.Summary summary(@PathVariable Long projectId) {
        return completion.get(projectId, null);
    }

    @PostMapping("/api/projects/{projectId}/final-grade/lock")
    @PreAuthorize("hasAnyAuthority('MILESTONE_WRITE', 'PRJ_WORKSPACE_MANAGE')")
    public SubmissionDtos.ProjectCompletionResult lock(@PathVariable Long projectId,
            @Valid @RequestBody SubmissionDtos.LockFinalGradeRequest request) {
        return commands.lockFinalGrade(projectId, null, request);
    }

    @PostMapping("/api/projects/{projectId}/milestones/{milestoneId}/waive")
    @PreAuthorize("hasAnyAuthority('MILESTONE_WRITE', 'PRJ_WORKSPACE_MANAGE')")
    public SubmissionDtos.ProjectCompletionResult waive(@PathVariable Long projectId, @PathVariable UUID milestoneId,
            @Valid @RequestBody SubmissionDtos.WaiveMilestoneRequest request) {
        return commands.waive(projectId, null, milestoneId, request);
    }
}
