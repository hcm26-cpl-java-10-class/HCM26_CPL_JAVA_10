package com.example.starter_project_2025.system.git_integration.controller;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.dto.GitHubConnectionView;
import com.example.starter_project_2025.system.git_integration.dto.GitInstallationResponse;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.service.GitConnectionQueryService;
import com.example.starter_project_2025.system.git_integration.service.GitConnectionService;
import com.example.starter_project_2025.system.git_integration.service.GitInstallationService;
import com.example.starter_project_2025.system.git_integration.service.GitIntegrationAccessService;
import com.example.starter_project_2025.system.rbac.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** GI-02: GitHub connection status of a project, and "Check again". Responses never carry tokens or secrets. */
@Tag(name = "Git Integration", description = "GI-02: GitHub connection status")
@RestController
@RequestMapping("/api/v1/git-integration")
@RequiredArgsConstructor
public class GitConnectionController {

    private final GitIntegrationAccessService access;
    private final GitConnectionQueryService queries;
    private final GitConnectionService connections;
    private final GitInstallationService installationService;
    private final GitInstallationRepository installations;

    @Operation(summary = "GitHub connection of a project (its master's repository's installation)")
    @GetMapping("/projects/{projectId}/github/connection")
    public GitHubConnectionView connection(@PathVariable Long projectId) {
        return queries.view(projectId);
    }

    @Operation(summary = "Check the project's GitHub connection again with GitHub (PM of the master, mentor, Git Integration manager)")
    @PostMapping("/projects/{projectId}/github/connection/recheck")
    public GitHubConnectionView.Recheck recheckProject(@PathVariable Long projectId) {
        User user = access.requireUser();
        Long installationRowId = queries.requireRecheckable(queries.resolve(user, projectId));
        boolean checked = connections.recheck(installationRowId).checked();
        return new GitHubConnectionView.Recheck(queries.resolve(user, projectId).view(), checked);
    }

    @Operation(summary = "Check an installation again with GitHub (requires GIT_INTEGRATION_MANAGE)")
    @PostMapping("/github/installations/{id}/recheck")
    public GitInstallationResponse recheckInstallation(@PathVariable Long id) {
        User user = access.requireUser();
        access.requireManage(user);
        GitInstallation installation = installations.findById(id)
                .filter(row -> row.getTenantId().equals(user.getTenant().getId()) && Boolean.TRUE.equals(row.getIsActive()))
                .orElseThrow(GitIntegrationException::installationNotFound);
        connections.recheck(installation.getId());
        return installationService.installation(installation.getId());
    }
}
