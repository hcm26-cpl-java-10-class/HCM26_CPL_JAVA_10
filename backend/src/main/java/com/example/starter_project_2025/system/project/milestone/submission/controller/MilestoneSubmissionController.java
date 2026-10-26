package com.example.starter_project_2025.system.project.milestone.submission.controller;

import com.example.starter_project_2025.system.project.milestone.submission.domain.*;
import com.example.starter_project_2025.system.project.milestone.submission.dto.SubmissionDtos;
import com.example.starter_project_2025.system.project.milestone.submission.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/milestone-submissions")
@RequiredArgsConstructor
public class MilestoneSubmissionController {
    private final SubmissionQueryService queryService;
    private final SubmissionReviewService reviewService;
    private final SubmissionVersionService versionService;

    @GetMapping
    public SubmissionDtos.PageResponse getPage(
            @RequestParam(required = false) UUID projectId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) SubmissionStatus status,
            @RequestParam(required = false) MilestoneExecutionStatus executionStatus,
            @RequestParam(required = false) Boolean mandatory,
            @RequestParam(required = false) Boolean late,
            @RequestParam(required = false) String bucket,
            @RequestParam(required = false) String sort) {
        return queryService.getPage(projectId, page, size, search, status, executionStatus,
                mandatory, late, bucket, sort);
    }

    @GetMapping("/{submissionId}")
    public SubmissionDtos.Detail getDetail(@PathVariable UUID submissionId) {
        return queryService.getDetail(submissionId);
    }

    @PostMapping("/{submissionId}/review")
    public SubmissionDtos.Detail review(@PathVariable UUID submissionId,
                                        @RequestHeader("Idempotency-Key") String idempotencyKey,
                                        @Valid @RequestBody SubmissionDtos.ReviewRequest request) {
        return reviewService.review(submissionId, idempotencyKey, request);
    }

    @PostMapping("/{submissionId}/versions")
    public SubmissionDtos.Detail createNextVersion(@PathVariable UUID submissionId,
                                                    @Valid @RequestBody SubmissionDtos.CreateVersionRequest request) {
        return versionService.createNextVersion(submissionId, request);
    }

    @PostMapping("/{submissionId}/submit")
    public SubmissionDtos.Detail submit(@PathVariable UUID submissionId,
                                        @RequestHeader("Idempotency-Key") String idempotencyKey) {
        return versionService.submit(submissionId, idempotencyKey);
    }

    @PutMapping("/{submissionId}/versions/{versionId}")
    public SubmissionDtos.Detail updateDraft(@PathVariable UUID submissionId,
                                              @PathVariable UUID versionId,
                                              @Valid @RequestBody SubmissionDtos.UpdateDraftRequest request) {
        return versionService.updateDraft(submissionId, versionId, request);
    }
}
