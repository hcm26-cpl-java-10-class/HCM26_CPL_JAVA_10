package com.example.starter_project_2025.system.project.analytics;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * US-ANL-001: Analytics Workspace Navigation, Shell & RBAC Access Control.
 *
 * <p>Only GET endpoints exist by design: opening the Analytics route must never
 * mutate Sprint/Task state or write a mutation audit entry. Authorization is
 * applied twice — at the HTTP layer through {@code @PreAuthorize} and again in
 * {@link ProjectAnalyticsAccess}, which re-reads the persisted role grants.</p>
 */
@RestController
@RequiredArgsConstructor
@RequestMapping({"/api/projects", "/api/v1/projects"})
@Tag(name = "Project Analytics", description = "Sprint and backlog analytics for one project")
public class ProjectAnalyticsController {

    private final ProjectAnalyticsService service;

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
    @Operation(summary = "Read the Analytics workspace shell for one project")
    public ResponseEntity<ProjectAnalyticsResponse> shell(@PathVariable String projectId) {
        // AC02: analytics never survives in an HTTP cache after the session ends.
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(service.shell(projectId));
    }
}
