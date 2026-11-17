package com.example.starter_project_2025.system.git_integration.controller;

import com.example.starter_project_2025.system.git_integration.dto.BacklogGitLinkSummary;
import com.example.starter_project_2025.system.git_integration.dto.BacklogGitLinksView;
import com.example.starter_project_2025.system.git_integration.dto.TaskLinkRecheckResult;
import com.example.starter_project_2025.system.git_integration.dto.TaskLinkStats;
import com.example.starter_project_2025.system.git_integration.service.BacklogGitLinkService;
import com.example.starter_project_2025.system.git_integration.service.RepositoryActivityQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Git Integration · Task links", description = "SY-05: commits and pull requests linked to tasks through Task IDs")
@RestController
@RequestMapping("/api/v1/git-integration")
@RequiredArgsConstructor
public class BacklogGitLinkController {

    private final BacklogGitLinkService linkService;
    private final RepositoryActivityQueryService activity;

    @Operation(summary = "Commits (newest first, paged) and pull requests linked to a task; anyone who can open the task")
    @GetMapping("/backlog-items/{itemId}/git-links")
    public BacklogGitLinksView itemLinks(@PathVariable Long itemId,
                                         @RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "20") int size) {
        return linkService.itemLinks(itemId, page, size);
    }

    @Operation(summary = "Link counts of up to 500 tasks (board badges); tasks the caller cannot open are left out")
    @GetMapping("/backlog-items/git-link-summary")
    public List<BacklogGitLinkSummary> summary(@RequestParam List<Long> ids) {
        return linkService.summary(ids);
    }

    @Operation(summary = "How well the repository's commits and pull requests reference tasks")
    @GetMapping("/projects/{projectId}/repository/task-links/stats")
    public TaskLinkStats stats(@PathVariable Long projectId) {
        return activity.taskLinkStats(projectId);
    }

    @Operation(summary = "Judge unresolved Task IDs again and process waiting commits / pull requests (Git Integration managers)")
    @PostMapping("/projects/{projectId}/repository/task-links/recheck")
    public TaskLinkRecheckResult recheck(@PathVariable Long projectId) {
        return linkService.recheck(projectId);
    }
}
