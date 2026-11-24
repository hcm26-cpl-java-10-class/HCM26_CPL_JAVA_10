package com.example.starter_project_2025.system.git_integration.controller;

import com.example.starter_project_2025.system.git_integration.dto.TaskLinkFilter;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestState;
import com.example.starter_project_2025.system.git_integration.dto.GitCommitItem;
import com.example.starter_project_2025.system.git_integration.dto.GitPage;
import com.example.starter_project_2025.system.git_integration.dto.GitPullRequestDetail;
import com.example.starter_project_2025.system.git_integration.dto.GitPullRequestItem;
import com.example.starter_project_2025.system.git_integration.dto.GitBranchItem;
import com.example.starter_project_2025.system.git_integration.dto.RepositoryActivityView;
import com.example.starter_project_2025.system.git_integration.dto.RepositoryInsightsView;
import com.example.starter_project_2025.system.git_integration.service.RepositoryActivityQueryService;
import com.example.starter_project_2025.system.git_integration.service.RepositoryInsightsQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Tag(name = "Git Integration · Repository activity", description = "SY-04: commits, pull requests and reviews synchronized from GitHub webhooks")
@RestController
@RequestMapping("/api/v1/git-integration/projects/{projectId}/repository")
@RequiredArgsConstructor
public class RepositoryActivityController {

    private final RepositoryActivityQueryService queryService;
    private final RepositoryInsightsQueryService insightsService;

    @Operation(summary = "Counts, latest commit and webhook health of the project's repository (a module reads its master's)")
    @GetMapping("/activity")
    public RepositoryActivityView activity(@PathVariable Long projectId) {
        return queryService.activity(projectId);
    }

    @Operation(summary = "Commits, newest first, with the Task IDs they mention; q searches message and SHA, branch is the first branch a commit was pushed to, link filters by task link verdict")
    @GetMapping("/commits")
    public GitPage<GitCommitItem> commits(@PathVariable Long projectId,
                                          @RequestParam(required = false) String q,
                                          @RequestParam(required = false) String author,
                                          @RequestParam(required = false) String branch,
                                          @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
                                          @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
                                          @RequestParam(required = false) TaskLinkFilter link,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "20") int size,
                                          @RequestParam(required = false) Long repositoryId) {
        return queryService.commits(projectId,
                new RepositoryActivityQueryService.CommitQuery(q, author, branch, from, to, link, page, size, repositoryId));
    }

    @Operation(summary = "Pull requests, most recently updated first, with each reviewer's current decision")
    @GetMapping("/pull-requests")
    public GitPage<GitPullRequestItem> pullRequests(@PathVariable Long projectId,
                                                    @RequestParam(required = false) GitPullRequestState state,
                                                    @RequestParam(required = false) String q,
                                                    @RequestParam(required = false) TaskLinkFilter link,
                                                    @RequestParam(defaultValue = "0") int page,
                                                    @RequestParam(defaultValue = "20") int size,
                                                    @RequestParam(required = false) Long repositoryId) {
        return queryService.pullRequests(projectId,
                new RepositoryActivityQueryService.PullRequestQuery(state, q, link, page, size, repositoryId));
    }

    @Operation(summary = "A pull request with its reviews")
    @GetMapping("/pull-requests/{number}")
    public GitPullRequestDetail pullRequest(@PathVariable Long projectId, @PathVariable int number,
                                            @RequestParam(required = false) Long repositoryId) {
        return queryService.pullRequest(projectId, number, repositoryId);
    }

    @Operation(summary = "WS-GH-02: activity of the period (7d, 30d, 90d, 6m, 1y ending today; all = since the first synchronized "
            + "activity; custom = since..until) — commits per day/week/month, contributors, branches — and the current state "
            + "of the open pull requests")
    @GetMapping("/insights")
    public RepositoryInsightsView insights(@PathVariable Long projectId,
                                           @RequestParam(required = false) String range,
                                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate since,
                                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate until,
                                           @RequestParam(required = false) Long repositoryId) {
        return insightsService.insights(projectId, range, since, until, repositoryId);
    }

    @Operation(summary = "WS-GH-02: branches the commits were first pushed to, latest activity first; q matches the name")
    @GetMapping("/branches")
    public List<GitBranchItem> branches(@PathVariable Long projectId,
                                        @RequestParam(required = false) String q,
                                        @RequestParam(required = false) Integer limit) {
        return insightsService.branches(projectId, q, limit);
    }
}
