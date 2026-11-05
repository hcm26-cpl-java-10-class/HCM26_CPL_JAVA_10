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
import com.example.starter_project_2025.system.project.milestone.dto.request.MilestonePlannedUpdateRequest;
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

    @PutMapping("/{milestoneId}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('MILESTONE_WRITE')")
    public MilestoneResponse editPlanned(@PathVariable Long projectId, @PathVariable UUID milestoneId, @RequestBody MilestonePlannedUpdateRequest request) {
        return lifecycle.editPlanned(projectId, request.teamId(), milestoneId, request);
    }

    @GetMapping({"/{milestoneId}/draft-revisions", "/{milestoneId}/revisions"})
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('MILESTONE_WRITE')")
    public List<com.example.starter_project_2025.system.project.milestone.domain.MilestoneDraftRevision> draftRevisions(
            @PathVariable Long projectId, @PathVariable UUID milestoneId) {
        return lifecycle.listDraftRevisions(projectId, null, milestoneId);
    }

    @PatchMapping("/{milestoneId}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('MILESTONE_WRITE')")
    public MilestoneResponse editActive(@PathVariable Long projectId, @PathVariable UUID milestoneId,
            @RequestBody com.example.starter_project_2025.system.project.milestone.dto.request.MilestoneLifecycleEditRequest request) {
        return lifecycle.editActive(projectId, null, milestoneId, request);
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
            @RequestParam(required = false) List<com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus> lifecycleStatus,
            @RequestParam(required = false) Boolean mandatory,
            @RequestParam(required = false) List<LatePolicyType> latePolicyType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate deadlineFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate deadlineTo
    ) {
        return ResponseEntity.ok(queryService.getList(projectId, new MilestoneListQuery(
                teamId, page, size, sort, search, status, mandatory, latePolicyType, deadlineFrom, deadlineTo, lifecycleStatus
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

}
