package com.example.starter_project_2025.system.git_integration.controller;

import com.example.starter_project_2025.system.git_integration.dto.GitSyncJobView;
import com.example.starter_project_2025.system.git_integration.dto.LinkRepositoryRequest;
import com.example.starter_project_2025.system.git_integration.dto.ProjectRepositoryView;
import com.example.starter_project_2025.system.git_integration.service.GitRepositoryLinkService;
import com.example.starter_project_2025.system.git_integration.service.GitSyncRetryService;
import com.example.starter_project_2025.system.git_integration.service.ProjectRepositoryQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@Tag(name = "Git Integration · Project repository", description = "GI-04: link a GitHub repository to a master project")
@RestController
@RequestMapping("/api/v1/git-integration/projects/{projectId}/repository")
@RequiredArgsConstructor
public class ProjectRepositoryController {

    private final ProjectRepositoryQueryService queryService;
    private final GitRepositoryLinkService linkService;
    private final GitSyncRetryService syncRetryService;

    @Operation(summary = "Repository of a project; a module returns its master project's repository (inherited=true)")
    @GetMapping
    public ProjectRepositoryView get(@PathVariable Long projectId) {
        return queryService.view(projectId);
    }

    @Operation(summary = "Link a GitHub repository to a master project and start the initial synchronization "
            + "(201 created, 200 when this repository is already linked to this project)")
    @PostMapping
    public ResponseEntity<ProjectRepositoryView> link(@PathVariable Long projectId,
                                                      @Valid @RequestBody LinkRepositoryRequest request) {
        GitRepositoryLinkService.LinkResult result = linkService.link(projectId, request);
        if (!result.created()) {
            return ResponseEntity.ok(result.view());
        }
        return ResponseEntity.created(ServletUriComponentsBuilder.fromCurrentRequest().build().toUri()).body(result.view());
    }

    @Operation(summary = "Queue the repository synchronization again after it failed "
            + "(202 queued, 200 when a synchronization is already waiting or running)")
    @PostMapping("/sync")
    public ResponseEntity<GitSyncJobView> sync(@PathVariable Long projectId) {
        GitSyncRetryService.RetryResult result = syncRetryService.retry(projectId);
        return ResponseEntity.status(result.queued() ? HttpStatus.ACCEPTED : HttpStatus.OK).body(result.job());
    }
}
