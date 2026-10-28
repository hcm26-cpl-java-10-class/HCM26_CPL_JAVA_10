package com.example.starter_project_2025.system.project.milestone.controller;

import com.example.starter_project_2025.system.project.milestone.dto.request.CreateMilestoneRequest;
import com.example.starter_project_2025.system.project.milestone.dto.request.MilestoneListQuery;
import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneCreateOptionsResponse;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneDetailResponse;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestonePageResponse;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneResponse;
import com.example.starter_project_2025.system.project.milestone.service.MilestoneCommandService;
import com.example.starter_project_2025.system.project.milestone.service.MilestoneCreateOptionsService;
import com.example.starter_project_2025.system.project.milestone.service.MilestoneQueryService;
import com.example.starter_project_2025.system.project.milestone.service.MilestoneLifecycleService;
import com.example.starter_project_2025.system.project.milestone.dto.request.MilestoneDraftRequest;
import com.example.starter_project_2025.system.project.milestone.dto.request.MilestoneMetadataRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/projects/{projectId}/milestones")
@RequiredArgsConstructor
public class MilestoneController {

    private final MilestoneCommandService commandService;
    private final MilestoneCreateOptionsService optionsService;
    private final MilestoneQueryService queryService;
    private final MilestoneLifecycleService lifecycle;

    @PostMapping("/drafts")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('MILESTONE_WRITE')")
    public MilestoneResponse saveDraft(@PathVariable Long projectId, @RequestBody MilestoneDraftRequest request) {
        return lifecycle.saveDraft(projectId, request.teamId(), request);
    }

    @PutMapping("/{milestoneId}/draft")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('MILESTONE_WRITE')")
    public MilestoneResponse editDraft(@PathVariable Long projectId, @PathVariable UUID milestoneId, @RequestBody MilestoneDraftRequest request) {
        return lifecycle.editDraft(projectId, request.teamId(), milestoneId, request);
    }

    @PostMapping("/{milestoneId}/publish")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('MILESTONE_WRITE')")
    public MilestoneResponse publish(@PathVariable Long projectId, @PathVariable UUID milestoneId, @RequestParam long expectedVersion) {
        return lifecycle.publish(projectId, null, milestoneId, expectedVersion);
    }

    @PostMapping("/{milestoneId}/start")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN','ADMINISTRATOR','SUPER_ADMIN','SYSTEM_ADMIN')")
    public MilestoneResponse start(@PathVariable Long projectId, @PathVariable UUID milestoneId, @RequestParam long expectedVersion) {
        return lifecycle.start(projectId, null, milestoneId, expectedVersion);
    }

    @PatchMapping("/{milestoneId}/metadata")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('MILESTONE_WRITE')")
    public MilestoneResponse editMetadata(@PathVariable Long projectId, @PathVariable UUID milestoneId, @RequestBody MilestoneMetadataRequest request) {
        return lifecycle.editPublished(projectId, null, milestoneId, request);
    }

    @DeleteMapping("/{milestoneId}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('MILESTONE_WRITE')")
    public ResponseEntity<Void> deleteDraft(@PathVariable Long projectId, @PathVariable UUID milestoneId, @RequestParam long expectedVersion) {
        lifecycle.deleteDraft(projectId, null, milestoneId, expectedVersion); return ResponseEntity.noContent().build();
    }


    @GetMapping
    public ResponseEntity<MilestonePageResponse> getList(
            @PathVariable Long projectId,
            @RequestParam(required = false) Long teamId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) List<String> sort,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) List<MilestoneStatus> status,
            @RequestParam(required = false) Boolean mandatory,
            @RequestParam(required = false) List<LatePolicyType> latePolicyType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate deadlineFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate deadlineTo
    ) {
        return ResponseEntity.ok(queryService.getList(projectId, new MilestoneListQuery(
                teamId, page, size, sort, search, status, mandatory, latePolicyType, deadlineFrom, deadlineTo
        )));
    }

    @GetMapping("/create-options")
    public ResponseEntity<MilestoneCreateOptionsResponse> getCreateOptions(@PathVariable Long projectId) {
        return ResponseEntity.ok(optionsService.getOptions(projectId));
    }

    @PostMapping
    public ResponseEntity<MilestoneResponse> create(
            @PathVariable Long projectId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody CreateMilestoneRequest request
    ) {
        MilestoneResponse response = commandService.create(projectId, idempotencyKey, request);
        return ResponseEntity.created(URI.create(
                "/api/projects/" + projectId + "/milestones/" + response.id()
        )).body(response);
    }

    @GetMapping("/{milestoneId}")
    public ResponseEntity<MilestoneDetailResponse> getDetail(
            @PathVariable Long projectId,
            @PathVariable UUID milestoneId,
            @RequestParam(required = false) Long teamId
    ) {
        return ResponseEntity.ok(queryService.getDetail(projectId, milestoneId, teamId));
    }

    @PostMapping("/{milestoneId}/open")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('MILESTONE_WRITE')")
    public ResponseEntity<MilestoneResponse> openForSubmissions(@PathVariable Long projectId, @PathVariable UUID milestoneId) {
        return ResponseEntity.ok(commandService.openForSubmissions(projectId, null, milestoneId));
    }
}
