package com.example.starter_project_2025.system.project.developmentinsights.controller;

import com.example.starter_project_2025.system.project.developmentinsights.service.GitDevelopmentReportExportService;
import java.io.IOException;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/workspaces/{workspaceId}/git-activity/reports")
@PreAuthorize("hasAnyAuthority('WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
@RequiredArgsConstructor
public class GitDevelopmentReportExportController {
    private final GitDevelopmentReportExportService exports;

    @GetMapping("/export/project")
    public ResponseEntity<byte[]> exportProject(
            @PathVariable Long workspaceId,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long sprintId,
            @RequestParam(required = false) Long developerId,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam GitDevelopmentReportExportService.Format format) throws IOException {
        var file = exports.project(workspaceId, projectId, sprintId, developerId, from, to, format);
        return response(file);
    }

    @GetMapping("/export/sprints/{sprintId}")
    public ResponseEntity<byte[]> exportSprint(@PathVariable Long workspaceId,
                                                @PathVariable Long sprintId,
                                                @RequestParam GitDevelopmentReportExportService.Format format)
            throws IOException {
        return response(exports.sprint(workspaceId, sprintId, format));
    }

    private ResponseEntity<byte[]> response(GitDevelopmentReportExportService.ExportFile file) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(file.fileName()).build().toString())
                .body(file.bytes());
    }
}
