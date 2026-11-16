package com.example.starter_project_2025.system.git_integration.controller;

import com.example.starter_project_2025.system.git_integration.domain.GitOAuthOutcome;
import com.example.starter_project_2025.system.git_integration.dto.GitHubCallbackRequest;
import com.example.starter_project_2025.system.git_integration.dto.GitHubCallbackResponse;
import com.example.starter_project_2025.system.git_integration.service.GitHubConnectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Git Integration", description = "Connect a project to a GitHub App installation")
@RestController
@RequestMapping("/api/v1/git-integration/github")
@RequiredArgsConstructor
public class GitHubCallbackController {

    private final GitHubConnectionService connectionService;

    @Operation(summary = "Complete Connect GitHub with the parameters GitHub sent to the callback URL")
    @PostMapping("/callback")
    public ResponseEntity<GitHubCallbackResponse> callback(@Valid @RequestBody GitHubCallbackRequest request) {
        GitHubCallbackResponse response = connectionService.handleCallback(request);
        HttpStatus status = response.outcome() == GitOAuthOutcome.PENDING_APPROVAL ? HttpStatus.ACCEPTED : HttpStatus.OK;
        return ResponseEntity.status(status).body(response);
    }
}
