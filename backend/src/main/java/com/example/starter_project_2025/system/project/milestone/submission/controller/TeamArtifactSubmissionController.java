package com.example.starter_project_2025.system.project.milestone.submission.controller;

import com.example.starter_project_2025.system.project.milestone.submission.dto.*;
import com.example.starter_project_2025.system.project.milestone.submission.service.TeamArtifactSubmissionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/teams/{teamId}/milestones")
@RequiredArgsConstructor
public class TeamArtifactSubmissionController {
    private final TeamArtifactSubmissionService service;

    @GetMapping("/{milestoneId}/artifact-draft")
    @PreAuthorize("hasAuthority('ARTIFACT_READ') and hasAnyRole('STUDENT', 'ADMIN')")
    public ResponseEntity<ArtifactSubmissionWorkspaceResponse> workspace(@PathVariable Long teamId, @PathVariable UUID milestoneId) {
        return ResponseEntity.ok(service.workspace(teamId, milestoneId));
    }
    @PutMapping("/{milestoneId}/artifact-draft")
    @PreAuthorize("hasAuthority('ARTIFACT_DRAFT_WRITE') and hasAnyRole('STUDENT', 'ADMIN')")
    public ResponseEntity<ArtifactDraftResponse> save(@PathVariable Long teamId, @PathVariable UUID milestoneId, @Valid @RequestBody ArtifactDraftRequest request) {
        return ResponseEntity.ok(service.save(teamId, milestoneId, request));
    }
    @PostMapping("/{milestoneId}/artifact-draft/submissions")
    @PreAuthorize("hasAuthority('ARTIFACT_SUBMIT') and hasAnyRole('STUDENT', 'ADMIN')")
    public ResponseEntity<ArtifactSubmissionResponse> submit(@PathVariable Long teamId, @PathVariable UUID milestoneId,
            @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody ArtifactSubmissionRequest request) {
        return ResponseEntity.status(201).body(service.submit(teamId, milestoneId, key, request));
    }
    @GetMapping("/submissions")
    public ResponseEntity<List<TeamArtifactSubmissionService.TeamSubmissionView>> submissions(
            @PathVariable Long teamId, @RequestParam(required = false) UUID milestoneId) {
        return ResponseEntity.ok(service.submissions(teamId, milestoneId));
    }
}
