package com.example.starter_project_2025.system.git_integration.controller;

import com.example.starter_project_2025.system.git_integration.domain.GitOAuthOutcome;
import com.example.starter_project_2025.system.git_integration.dto.GitHubCallbackRequest;
import com.example.starter_project_2025.system.git_integration.dto.GitHubCallbackResponse;
import com.example.starter_project_2025.system.git_integration.dto.GitHubConnectStartResponse;
import com.example.starter_project_2025.system.git_integration.dto.GitInstallationListResponse;
import com.example.starter_project_2025.system.git_integration.dto.GitRepositoryPage;
import com.example.starter_project_2025.system.git_integration.service.GitInstallationService;
import com.example.starter_project_2025.system.git_integration.service.GitRepositoryBrowseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Git Integration", description = "GI-01: install the GitHub App on a GitHub account or organization")
@RestController
@RequestMapping("/api/v1/git-integration/github")
@RequiredArgsConstructor
public class GitInstallationController {

    private final GitInstallationService installationService;
    private final GitRepositoryBrowseService repositoryBrowseService;

    @Operation(summary = "GitHub App installations of the current organization")
    @GetMapping("/installations")
    public GitInstallationListResponse installations() {
        return installationService.listInstallations();
    }

    @Operation(summary = "US-GI-03: repositories the installation can access (search + filter + paging on a 5-minute cache)")
    @GetMapping("/installations/{id}/repositories")
    public GitRepositoryPage repositories(@PathVariable Long id,
                                          @RequestParam(required = false) String q,
                                          @RequestParam(defaultValue = "all") String filter,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "20") int size,
                                          @RequestParam(defaultValue = "false") boolean refresh,
                                          @RequestParam(required = false) Long projectId) {
        return repositoryBrowseService.browse(id, q, filter, page, size, refresh, projectId);
    }

    @Operation(summary = "Start Connect GitHub: returns the GitHub App install URL (requires GIT_INTEGRATION_MANAGE)")
    @PostMapping("/connect")
    public GitHubConnectStartResponse connect() {
        return installationService.startConnect();
    }

    @Operation(summary = "Complete Connect GitHub with the parameters GitHub sent to the callback URL")
    @PostMapping("/callback")
    public ResponseEntity<GitHubCallbackResponse> callback(@Valid @RequestBody GitHubCallbackRequest request) {
        GitHubCallbackResponse response = installationService.handleCallback(request);
        HttpStatus status = response.outcome() == GitOAuthOutcome.PENDING_APPROVAL ? HttpStatus.ACCEPTED : HttpStatus.OK;
        return ResponseEntity.status(status).body(response);
    }
}
