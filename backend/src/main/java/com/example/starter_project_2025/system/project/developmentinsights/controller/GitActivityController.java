package com.example.starter_project_2025.system.project.developmentinsights.controller;

import com.example.starter_project_2025.system.project.developmentinsights.dto.GitActivityDtos;
import com.example.starter_project_2025.system.project.developmentinsights.service.GitActivityService;
import com.example.starter_project_2025.system.project.developmentinsights.service.GitReviewAnalyticsService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/workspaces/{workspaceId}/git-activity")
@PreAuthorize("hasAnyAuthority('WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
@RequiredArgsConstructor
public class GitActivityController {
    private final GitActivityService service;
    private final GitReviewAnalyticsService reviewAnalytics;

    @GetMapping("/status")
    public GitActivityDtos.RepositoryStatus status(@PathVariable Long workspaceId) {
        return service.status(workspaceId);
    }

    @GetMapping("/tasks/{taskId}")
    public GitActivityDtos.TaskContext taskContext(@PathVariable Long workspaceId, @PathVariable Long taskId) {
        return service.taskContext(workspaceId, taskId);
    }

    @GetMapping("/filters")
    public GitActivityDtos.FilterOptions filters(@PathVariable Long workspaceId,
                                                 @RequestParam(required = false) Long projectId) {
        return service.filterOptions(workspaceId, projectId);
    }

    @GetMapping("/commits")
    public Page<GitActivityDtos.CommitItem> commits(
            @PathVariable Long workspaceId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "newest") String sort,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long taskId,
            @RequestParam(required = false) Long developerId,
            @RequestParam(required = false) Long contributorId,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) Boolean unmappedOnly,
            @RequestParam(required = false) Boolean includeBots,
            @RequestParam(required = false) Boolean includeMergeCommits,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.commits(workspaceId, search, sort, page, size, projectId, taskId, developerId,
                contributorId, branch, unmappedOnly, includeBots, includeMergeCommits, from, to);
    }

    @GetMapping("/analytics/commits")
    public GitActivityDtos.CommitAnalytics commitAnalytics(
            @PathVariable Long workspaceId,
            @RequestParam(defaultValue = "day") String granularity,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long taskId,
            @RequestParam(required = false) Long developerId,
            @RequestParam(required = false) Long contributorId,
            @RequestParam(required = false) Boolean unmappedOnly,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "true") boolean includeBots,
            @RequestParam(defaultValue = "false") boolean includeMergeCommits) {
        return service.commitAnalytics(workspaceId, granularity, projectId, taskId, developerId,
                contributorId, unmappedOnly, branch, from, to, includeBots, includeMergeCommits);
    }

    @GetMapping("/analytics/pull-requests")
    public GitActivityDtos.PullRequestAnalytics pullRequestAnalytics(
            @PathVariable Long workspaceId,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long taskId,
            @RequestParam(required = false) Long developerId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.pullRequestAnalytics(workspaceId, projectId, taskId, developerId, from, to);
    }

    @GetMapping("/analytics/reviews")
    public GitActivityDtos.CodeReviewAnalytics reviewAnalytics(
            @PathVariable Long workspaceId,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long developerId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return reviewAnalytics.report(workspaceId, projectId, developerId, from, to);
    }

    @GetMapping("/analytics/developers")
    public GitActivityDtos.DeveloperActivity developerActivity(
            @PathVariable Long workspaceId,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long developerId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.developerActivity(workspaceId, projectId, from, to, developerId);
    }

    @GetMapping("/reports/options")
    public GitActivityDtos.ReportOptions reportOptions(@PathVariable Long workspaceId,
                                                        @RequestParam(required = false) Long projectId) {
        return service.reportOptions(workspaceId, projectId);
    }

    @GetMapping("/reports/sprints/{sprintId}")
    public GitActivityDtos.SprintDevelopmentReport sprintDevelopmentReport(@PathVariable Long workspaceId,
                                                                           @PathVariable Long sprintId) {
        return service.sprintDevelopmentReport(workspaceId, sprintId);
    }

    @GetMapping("/reports/project")
    public GitActivityDtos.ProjectDevelopmentReport projectDevelopmentReport(
            @PathVariable Long workspaceId,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long sprintId,
            @RequestParam(required = false) Long developerId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.projectDevelopmentReport(workspaceId, projectId, sprintId, from, to, developerId);
    }

    @GetMapping("/pull-requests")
    public Page<GitActivityDtos.PullRequestItem> pullRequests(
            @PathVariable Long workspaceId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "newest") String sort,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long taskId,
            @RequestParam(required = false) Long developerId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.pullRequests(workspaceId, search, sort, page, size, projectId, taskId, developerId, from, to);
    }

    @GetMapping("/commits/{commitId}")
    public GitActivityDtos.CommitDetails commit(@PathVariable Long workspaceId, @PathVariable Long commitId) {
        return service.commit(workspaceId, commitId);
    }

    @GetMapping("/pull-requests/{pullRequestId}")
    public GitActivityDtos.PullRequestDetails pullRequest(@PathVariable Long workspaceId,
                                                          @PathVariable Long pullRequestId) {
        return service.pullRequest(workspaceId, pullRequestId);
    }
}
