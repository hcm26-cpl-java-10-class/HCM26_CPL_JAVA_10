package com.example.starter_project_2025.system.project.milestone.controller;

import com.example.starter_project_2025.system.project.milestone.dto.request.CreateMilestoneRequest;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneResponse;
import com.example.starter_project_2025.system.project.milestone.service.MilestoneCommandService;
import com.example.starter_project_2025.system.project.milestone.service.MilestoneCreateOptionsService;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneCreateOptionsResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequestMapping("/api/teams/{teamId}/milestones")
@RequiredArgsConstructor
public class TeamMilestoneController {
    private final MilestoneCommandService commandService;
    private final MilestoneCreateOptionsService optionsService;

    @GetMapping("/create-options")
    @PreAuthorize("hasAuthority('MILESTONE_WRITE')")
    public MilestoneCreateOptionsResponse createOptions(@PathVariable Long teamId) {
        return optionsService.getTeamOptions(teamId);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('MILESTONE_WRITE')")
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
