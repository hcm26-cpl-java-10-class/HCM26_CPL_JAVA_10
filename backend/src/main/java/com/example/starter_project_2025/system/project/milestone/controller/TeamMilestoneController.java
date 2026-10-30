package com.example.starter_project_2025.system.project.milestone.controller;

import com.example.starter_project_2025.system.project.milestone.dto.request.CreateMilestoneRequest;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneResponse;
import com.example.starter_project_2025.system.project.milestone.service.MilestoneCommandService;
import com.example.starter_project_2025.system.project.milestone.service.MilestoneLifecycleService;
import com.example.starter_project_2025.system.project.milestone.dto.request.MilestoneDraftRequest;
import com.example.starter_project_2025.system.project.milestone.service.MilestoneCreateOptionsService;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneCreateOptionsResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequestMapping("/api/teams/{teamId}/milestones")
@RequiredArgsConstructor
public class TeamMilestoneController {
    private final MilestoneCommandService commandService;
    private final MilestoneCreateOptionsService optionsService;
    private final MilestoneLifecycleService lifecycle;

    @PostMapping("/drafts")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('MILESTONE_WRITE')")
    public MilestoneResponse saveDraft(@PathVariable Long teamId, @RequestBody MilestoneDraftRequest request) {
        return lifecycle.saveDraft(null, teamId, request);
    }

    @PutMapping("/{milestoneId}/draft")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('MILESTONE_WRITE')")
    public MilestoneResponse editDraft(@PathVariable Long teamId, @PathVariable java.util.UUID milestoneId, @RequestBody MilestoneDraftRequest request) {
        return lifecycle.editDraft(null, teamId, milestoneId, request);
    }

    @GetMapping({"/{milestoneId}/draft-revisions", "/{milestoneId}/revisions"})
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('MILESTONE_WRITE')")
    public java.util.List<com.example.starter_project_2025.system.project.milestone.domain.MilestoneDraftRevision> draftRevisions(
            @PathVariable Long teamId, @PathVariable java.util.UUID milestoneId) {
        return lifecycle.listDraftRevisions(null, teamId, milestoneId);
    }

    @PostMapping("/{milestoneId}/publish")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('MILESTONE_WRITE')")
    public MilestoneResponse publish(@PathVariable Long teamId, @PathVariable java.util.UUID milestoneId,
            @RequestParam long expectedVersion) {
        return lifecycle.publish(null, teamId, milestoneId, expectedVersion);
    }

    @PostMapping("/{milestoneId}/open")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('MILESTONE_WRITE')")
    public MilestoneResponse open(@PathVariable Long teamId, @PathVariable java.util.UUID milestoneId) {
        return lifecycle.open(null, teamId, milestoneId);
    }

    @PostMapping("/{milestoneId}/start")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN','ADMINISTRATOR','SUPER_ADMIN','SYSTEM_ADMIN')")
    public MilestoneResponse start(@PathVariable Long teamId, @PathVariable java.util.UUID milestoneId,
            @RequestParam long expectedVersion) {
        return lifecycle.start(null, teamId, milestoneId, expectedVersion);
    }

    @PatchMapping("/{milestoneId}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('MILESTONE_WRITE')")
    public MilestoneResponse editActive(@PathVariable Long teamId, @PathVariable java.util.UUID milestoneId,
            @RequestBody com.example.starter_project_2025.system.project.milestone.dto.request.MilestoneLifecycleEditRequest request) {
        return lifecycle.editActive(null, teamId, milestoneId, request);
    }

    @DeleteMapping("/{milestoneId}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('MILESTONE_WRITE')")
    public ResponseEntity<Void> deleteDraft(@PathVariable Long teamId, @PathVariable java.util.UUID milestoneId, @RequestParam long expectedVersion) {
        lifecycle.deleteDraft(null, teamId, milestoneId, expectedVersion); return ResponseEntity.noContent().build();
    }

    @GetMapping("/create-options")
    public MilestoneCreateOptionsResponse createOptions(@PathVariable Long teamId) {
        return optionsService.getTeamOptions(teamId);
    }

    @PostMapping
    public ResponseEntity<MilestoneResponse> create(
            @PathVariable Long teamId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody CreateMilestoneRequest request) {
        if (!teamId.equals(request.teamId())) {
            throw new IllegalArgumentException("teamId path and payload must match");
        }
        MilestoneResponse response = commandService.create(null, idempotencyKey, request);
        return ResponseEntity.created(URI.create("/api/teams/" + teamId + "/milestones/" + response.id())).body(response);
    }

}
