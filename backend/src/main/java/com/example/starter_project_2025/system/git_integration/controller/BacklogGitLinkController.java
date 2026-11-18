package com.example.starter_project_2025.system.git_integration.controller;

import com.example.starter_project_2025.system.git_integration.dto.BacklogGitLinkSummary;
import com.example.starter_project_2025.system.git_integration.dto.BacklogGitLinksView;
import com.example.starter_project_2025.system.git_integration.dto.LinkPullRequestRequest;
import com.example.starter_project_2025.system.git_integration.dto.LinkedPullRequestItem;
import com.example.starter_project_2025.system.git_integration.dto.PullRequestCandidate;
import com.example.starter_project_2025.system.git_integration.dto.TaskLinkRecheckResult;
import com.example.starter_project_2025.system.git_integration.dto.TaskLinkStats;
import com.example.starter_project_2025.system.git_integration.dto.UpdateGitLinkRequest;
import com.example.starter_project_2025.system.git_integration.service.BacklogGitLinkCommandService;
import com.example.starter_project_2025.system.git_integration.service.BacklogGitLinkService;
import com.example.starter_project_2025.system.git_integration.service.RepositoryActivityQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Git Integration · Task links",
        description = "SY-05 / TM-03: commits and pull requests linked to tasks through Task IDs, or manually")
@RestController
@RequestMapping("/api/v1/git-integration")
@RequiredArgsConstructor
public class BacklogGitLinkController {

    private final BacklogGitLinkService linkService;
    private final BacklogGitLinkCommandService commands;
    private final RepositoryActivityQueryService activity;

    @Operation(summary = "Commits (newest first, paged) and pull requests linked to a task; anyone who can open the task")
    @GetMapping("/backlog-items/{itemId}/git-links")
    public BacklogGitLinksView itemLinks(@PathVariable Long itemId,
                                         @RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "20") int size) {
        return linkService.itemLinks(itemId, page, size);
    }

    @Operation(summary = "TM-03: link a pull request of the task's repository by number (pins an automatic link); 201 when new")
    @PostMapping("/backlog-items/{itemId}/git-links")
    public ResponseEntity<LinkedPullRequestItem> link(@PathVariable Long itemId, @Valid @RequestBody LinkPullRequestRequest request) {
        BacklogGitLinkCommandService.LinkResult result = commands.link(itemId, request);
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.item());
    }

    @Operation(summary = "TM-03: pin an automatic link ({\"source\": \"MANUAL\"}) so editing the pull request no longer removes it")
    @PatchMapping("/backlog-items/{itemId}/git-links/{linkId}")
    public LinkedPullRequestItem update(@PathVariable Long itemId, @PathVariable Long linkId,
                                        @Valid @RequestBody UpdateGitLinkRequest request) {
        return commands.update(itemId, linkId, request);
    }

    @Operation(summary = "TM-03: unlink a pull request from the task; it is not linked again automatically")
    @DeleteMapping("/backlog-items/{itemId}/git-links/{linkId}")
    public ResponseEntity<Void> unlink(@PathVariable Long itemId, @PathVariable Long linkId) {
        commands.unlink(itemId, linkId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "TM-03: pull requests of the task's repository to pick from (#number or title), at most 10")
    @GetMapping("/backlog-items/{itemId}/git-links/candidates")
    public List<PullRequestCandidate> candidates(@PathVariable Long itemId, @RequestParam(required = false) String q) {
        return commands.candidates(itemId, q);
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
