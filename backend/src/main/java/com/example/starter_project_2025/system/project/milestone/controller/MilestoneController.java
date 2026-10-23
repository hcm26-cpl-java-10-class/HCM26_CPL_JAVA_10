package com.example.starter_project_2025.system.project.milestone.controller;

import com.example.starter_project_2025.system.project.milestone.dto.request.CreateMilestoneRequest;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneCreateOptionsResponse;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneDetailResponse;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestonePageResponse;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneResponse;
import com.example.starter_project_2025.system.project.milestone.service.MilestoneCommandService;
import com.example.starter_project_2025.system.project.milestone.service.MilestoneCreateOptionsService;
import com.example.starter_project_2025.system.project.milestone.service.MilestoneQueryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/projects/{projectId}/milestones")
@RequiredArgsConstructor
public class MilestoneController {

    private final MilestoneCommandService commandService;
    private final MilestoneCreateOptionsService optionsService;
    private final MilestoneQueryService queryService;

    @GetMapping
    @PreAuthorize("hasAuthority('MILESTONE_READ')")
    public ResponseEntity<MilestonePageResponse> getList(
            @PathVariable UUID projectId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(queryService.getList(projectId, page, size));
    }

    @GetMapping("/create-options")
    @PreAuthorize("hasAuthority('MILESTONE_CREATE')")
    public ResponseEntity<MilestoneCreateOptionsResponse> getCreateOptions(@PathVariable UUID projectId) {
        return ResponseEntity.ok(optionsService.getOptions(projectId));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('MILESTONE_CREATE')")
    public ResponseEntity<MilestoneResponse> create(
            @PathVariable UUID projectId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody CreateMilestoneRequest request
    ) {
        MilestoneResponse response = commandService.create(projectId, idempotencyKey, request);
        return ResponseEntity.created(URI.create(
                "/api/projects/" + projectId + "/milestones/" + response.id()
        )).body(response);
    }

    @GetMapping("/{milestoneId}")
    @PreAuthorize("hasAuthority('MILESTONE_READ')")
    public ResponseEntity<MilestoneDetailResponse> getDetail(
            @PathVariable UUID projectId,
            @PathVariable UUID milestoneId
    ) {
        return ResponseEntity.ok(queryService.getDetail(projectId, milestoneId));
    }
}
