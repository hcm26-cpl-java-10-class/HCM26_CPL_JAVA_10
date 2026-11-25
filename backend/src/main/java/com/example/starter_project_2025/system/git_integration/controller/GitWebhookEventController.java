package com.example.starter_project_2025.system.git_integration.controller;

import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEventStatus;
import com.example.starter_project_2025.system.git_integration.dto.GitPage;
import com.example.starter_project_2025.system.git_integration.dto.GitWebhookEventItem;
import com.example.starter_project_2025.system.git_integration.service.GitWebhookEventQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Tag(name = "Git Integration · Webhook deliveries", description = "SY-04: processing status of GitHub webhooks and manual replay")
@RestController
@RequestMapping("/api/v1/git-integration/webhook-events")
@RequiredArgsConstructor
public class GitWebhookEventController {

    private final GitWebhookEventQueryService service;

    @Operation(summary = "Webhook deliveries of the organization, newest first (payloads are never returned)")
    @GetMapping
    public GitPage<GitWebhookEventItem> list(@RequestParam(required = false) GitWebhookEventStatus status,
                                             @RequestParam(required = false) String eventType,
                                             @RequestParam(required = false) Long projectId,
                                             @RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "20") int size) {
        return service.list(new GitWebhookEventQueryService.EventQuery(status, eventType, projectId, page, size));
    }

    @Operation(summary = "Process a FAILED event (or an IGNORED push / pull request / review event) again; 202 when queued")
    @PostMapping("/{id}/replay")
    public ResponseEntity<Map<String, Object>> replay(@PathVariable Long id) {
        service.replay(id);
        return ResponseEntity.accepted().body(Map.of("id", id, "status", "queued"));
    }
}
