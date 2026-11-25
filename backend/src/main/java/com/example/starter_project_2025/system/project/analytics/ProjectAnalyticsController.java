package com.example.starter_project_2025.system.project.analytics;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

/**
 * US-ANL-001: Analytics Workspace Navigation, Shell &amp; RBAC Access Control.
 * US-ANL-002: Sprint &amp; Backlog Data Collection &amp; Scope Filter Controls.
 *
 * <p>Only GET endpoints exist by design: opening the Analytics route must never
 * mutate Sprint/Task state or write a mutation audit entry. Authorization is
 * applied twice — at the HTTP layer through {@code @PreAuthorize} and again in
 * {@link ProjectAnalyticsAccess}, which re-reads the persisted role grants.</p>
 *
 * <p>Invalid filters (unknown scope/type, inverted date range, sprint of
 * another project) are answered with HTTP 422 by
 * {@link ProjectAnalyticsErrors}.</p>
 */
@RestController
@RequiredArgsConstructor
@RequestMapping({"/api/projects", "/api/v1/projects"})
@Tag(name = "Project Analytics", description = "Sprint and backlog analytics for one project")
public class ProjectAnalyticsController {

    private final ProjectAnalyticsService service;
    private final ProjectAnalyticsExportService exportService;

    @GetMapping("/analytics/options")
    @PreAuthorize("hasAuthority('PROJECT_ANALYTICS_READ')")
    @Operation(summary = "List projects the caller may open Analytics for")
    public ResponseEntity<List<ProjectAnalyticsProjectOption>> projects() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(service.projects());
    }

    @GetMapping("/{projectId}/analytics")
    @PreAuthorize("hasAuthority('PROJECT_ANALYTICS_READ')")
    @Operation(summary = "Read the filtered Analytics payload (KPIs and trend charts) for one project")
    public ResponseEntity<ProjectAnalyticsResponse> shell(@PathVariable String projectId,
                                                          @ModelAttribute ProjectAnalyticsFilter filter) {
        // AC02: analytics never survives in an HTTP cache after the session ends.
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(service.shell(projectId, filter));
    }

    @GetMapping("/{projectId}/analytics/drill-down")
    @PreAuthorize("hasAuthority('PROJECT_ANALYTICS_READ')")
    @Operation(summary = "US-ANL-008: List underlying work items for one clicked chart date/series")
    public ResponseEntity<ProjectAnalyticsDrillDownResponse> drillDown(
            @PathVariable String projectId,
            @ModelAttribute ProjectAnalyticsFilter filter,
            @RequestParam String chart,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String series) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(service.drillDown(projectId, filter, chart, date, series));
    }

    @PostMapping("/{projectId}/analytics/export")
    @PreAuthorize("hasAuthority('PROJECT_ANALYTICS_EXPORT')")
    @Operation(summary = "US-ANL-010: Export filtered Sprint & Backlog analytics report as CSV, XLSX (multi-sheet) or PDF")
    public ResponseEntity<byte[]> export(
            @PathVariable String projectId,
            @RequestBody(required = false) ProjectAnalyticsExportRequest body,
            @RequestParam(required = false) String format,
            @ModelAttribute ProjectAnalyticsFilter queryFilter,
            @RequestHeader(value = "X-Correlation-Id", required = false) String correlationId) {
        ProjectAnalyticsExportRequest effective = body != null
                ? body
                : new ProjectAnalyticsExportRequest(
                        format,
                        queryFilter.scope(),
                        queryFilter.sprintId(),
                        queryFilter.startDate(),
                        queryFilter.endDate(),
                        queryFilter.itemType());
        ProjectAnalyticsExportService.ExportFile file =
                exportService.export(projectId, effective, correlationId);
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(file.filename(), StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(file.contentType())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .header("X-Correlation-Id", file.correlationId())
                .body(file.content());
    }
}
