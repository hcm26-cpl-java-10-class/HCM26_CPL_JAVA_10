package com.example.starter_project_2025.system.git_integration.controller;

import com.example.starter_project_2025.system.git_integration.domain.GitSyncHistorySource;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncHistoryStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncHistoryType;
import com.example.starter_project_2025.system.git_integration.dto.GitSyncHistoryDetail;
import com.example.starter_project_2025.system.git_integration.dto.GitSyncHistoryPage;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.service.GitSyncHistoryQueryService;
import com.example.starter_project_2025.system.git_integration.service.GitSyncHistoryRetryService;
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

import java.util.Locale;
import java.util.Map;

@Tag(name = "Git Integration · Sync history", description = "SY-06: synchronization history of a project's repository and retry of failed webhooks")
@RestController
@RequestMapping("/api/v1/git-integration/projects/{projectId}/repository/sync-history")
@RequiredArgsConstructor
public class GitSyncHistoryController {

    private final GitSyncHistoryQueryService queryService;
    private final GitSyncHistoryRetryService retryService;

    @Operation(summary = "Synchronizations of the project's repository, newest first (current repository unless repositoryId is given)")
    @GetMapping
    public GitSyncHistoryPage list(@PathVariable Long projectId,
                                   @RequestParam(required = false) GitSyncHistoryType type,
                                   @RequestParam(required = false) GitSyncHistoryStatus status,
                                   @RequestParam(required = false) Long repositoryId,
                                   @RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "20") int size) {
        return queryService.list(projectId, new GitSyncHistoryQueryService.HistoryQuery(type, status, repositoryId, page, size));
    }

    @Operation(summary = "One synchronization: records processed and error (source = job | webhook)")
    @GetMapping("/{source}/{id}")
    public GitSyncHistoryDetail detail(@PathVariable Long projectId, @PathVariable String source, @PathVariable Long id) {
        return queryService.detail(projectId, source(source), id);
    }

    @Operation(summary = "Process a FAILED webhook delivery of the project's repository again; 202 when queued")
    @PostMapping("/webhook/{id}/retry")
    public ResponseEntity<Map<String, Object>> retry(@PathVariable Long projectId, @PathVariable Long id) {
        retryService.retry(projectId, id);
        return ResponseEntity.accepted().body(Map.of("id", id, "status", "queued"));
    }

    private static GitSyncHistorySource source(String value) {
        try {
            return GitSyncHistorySource.valueOf(value.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException unknown) {
            throw GitIntegrationException.syncHistoryNotFound();
        }
    }
}
