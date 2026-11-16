package com.example.starter_project_2025.system.git_integration.controller;

import com.example.starter_project_2025.system.git_integration.dto.GitHubConnectStartResponse;
import com.example.starter_project_2025.system.git_integration.dto.GitHubConnectionStatusResponse;
import com.example.starter_project_2025.system.git_integration.service.GitHubConnectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Git Integration", description = "Connect a project to a GitHub App installation")
@RestController
@RequestMapping("/api/v1/projects/{projectId}/git-integration/github")
@RequiredArgsConstructor
public class ProjectGitIntegrationController {

    private final GitHubConnectionService connectionService;

    @Operation(summary = "GitHub connection status of a project")
    @GetMapping
    public GitHubConnectionStatusResponse status(@PathVariable Long projectId) {
        return connectionService.getStatus(projectId);
    }

    @Operation(summary = "Start Connect GitHub: returns the GitHub App install URL (requires GIT_INTEGRATION_MANAGE)")
    @PostMapping("/connect")
    public GitHubConnectStartResponse connect(@PathVariable Long projectId) {
        return connectionService.startConnect(projectId);
    }
}
