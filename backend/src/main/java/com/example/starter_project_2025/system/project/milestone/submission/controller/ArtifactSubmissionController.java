package com.example.starter_project_2025.system.project.milestone.submission.controller;

import com.example.starter_project_2025.system.project.milestone.submission.dto.ArtifactDraftRequest;
import com.example.starter_project_2025.system.project.milestone.submission.dto.ArtifactDraftResponse;
import com.example.starter_project_2025.system.project.milestone.submission.dto.ArtifactSubmissionWorkspaceResponse;
import com.example.starter_project_2025.system.project.milestone.submission.service.ArtifactDraftService;
import com.example.starter_project_2025.system.project.milestone.submission.service.ArtifactSubmissionService;
import com.example.starter_project_2025.system.project.milestone.submission.dto.ArtifactSubmissionRequest;
import com.example.starter_project_2025.system.project.milestone.submission.dto.ArtifactSubmissionResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;
import org.springframework.web.multipart.MultipartFile;
import com.example.starter_project_2025.system.project.milestone.submission.dto.ArtifactAttachmentResponse;
import com.example.starter_project_2025.system.project.milestone.submission.service.ArtifactUploadService;

@RestController
@RequestMapping("/api/projects/{projectId}/milestones/{milestoneId}/artifact-draft")
@RequiredArgsConstructor
public class ArtifactSubmissionController {
    private final ArtifactDraftService draftService;
    private final ArtifactUploadService uploadService;
    private final ArtifactSubmissionService submissionService;

    @GetMapping
    @PreAuthorize("hasAuthority('ARTIFACT_READ') and hasRole('STUDENT')")
    public ResponseEntity<ArtifactSubmissionWorkspaceResponse> getWorkspace(
            @PathVariable UUID projectId, @PathVariable UUID milestoneId) {
        return ResponseEntity.ok(draftService.getWorkspace(projectId, milestoneId));
    }

    @PutMapping
    @PreAuthorize("hasAuthority('ARTIFACT_DRAFT_WRITE') and hasRole('STUDENT')")
    public ResponseEntity<ArtifactDraftResponse> save(
            @PathVariable UUID projectId,
            @PathVariable UUID milestoneId,
            @Valid @RequestBody ArtifactDraftRequest request) {
        return ResponseEntity.ok(draftService.save(projectId, milestoneId, request));
    }

    @PostMapping(value = "/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('ARTIFACT_DRAFT_WRITE') and hasRole('STUDENT')")
    public ResponseEntity<ArtifactAttachmentResponse> upload(
            @PathVariable UUID projectId, @PathVariable UUID milestoneId,
            @RequestPart("file") MultipartFile file) {
        return ResponseEntity.ok(uploadService.upload(projectId, milestoneId, file));
    }

    @PostMapping("/submissions")
    @PreAuthorize("hasAuthority('ARTIFACT_SUBMIT') and hasRole('STUDENT')")
    public ResponseEntity<ArtifactSubmissionResponse> submit(
            @PathVariable UUID projectId,
            @PathVariable UUID milestoneId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody ArtifactSubmissionRequest request) {
        return ResponseEntity.status(201)
                .body(submissionService.submit(projectId, milestoneId, idempotencyKey, request));
    }
}
