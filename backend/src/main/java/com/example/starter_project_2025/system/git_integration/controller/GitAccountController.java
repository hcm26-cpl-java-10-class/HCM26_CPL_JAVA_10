package com.example.starter_project_2025.system.git_integration.controller;

import com.example.starter_project_2025.system.git_integration.contributor.GitAccountAdminService;
import com.example.starter_project_2025.system.git_integration.contributor.GitAccountConnectService;
import com.example.starter_project_2025.system.git_integration.dto.AssignContributorRequest;
import com.example.starter_project_2025.system.git_integration.dto.GitAccountCallbackRequest;
import com.example.starter_project_2025.system.git_integration.dto.GitAccountConnectResponse;
import com.example.starter_project_2025.system.git_integration.dto.GitAccountsOverview;
import com.example.starter_project_2025.system.git_integration.dto.GitContributorView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * GI-06: connect a member's GitHub account and map contributors to project members. Every
 * {@code projectId} may be a module: the mapping lives at its master project (AC07).
 */
@Tag(name = "Git Integration", description = "GI-06: connect GitHub account & map to project member")
@RestController
@RequestMapping("/api/v1/git-integration")
@RequiredArgsConstructor
public class GitAccountController {

    private final GitAccountConnectService connectService;
    private final GitAccountAdminService adminService;

    @Operation(summary = "Connect the signed-in member's GitHub account: CONNECTED at once when the account is "
            + "already verified, else AUTHORIZE_REQUIRED with the GitHub authorization URL")
    @PostMapping("/projects/{projectId}/github-account/connect")
    public GitAccountConnectResponse connect(@PathVariable Long projectId) {
        return connectService.connect(projectId);
    }

    @Operation(summary = "Complete Connect GitHub account with the parameters GitHub sent to the callback URL")
    @PostMapping("/github/account-callback")
    public GitAccountConnectResponse callback(@Valid @RequestBody GitAccountCallbackRequest request) {
        return connectService.callback(request);
    }

    @Operation(summary = "GitHub accounts of the master project: viewer state, members with their accounts "
            + "and activity, unmapped contributors")
    @GetMapping("/projects/{projectId}/github-accounts")
    public GitAccountsOverview accounts(@PathVariable Long projectId) {
        return adminService.overview(projectId);
    }

    @Operation(summary = "Unlink a member's GitHub account in the master project (PM, or the member). Git data is kept")
    @DeleteMapping("/projects/{projectId}/github-accounts/{userId}")
    public ResponseEntity<Void> unlink(@PathVariable Long projectId, @PathVariable Long userId) {
        adminService.unlink(projectId, userId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Assign an e-mail-only contributor to a member (PM). Other e-mails are never merged")
    @PostMapping("/projects/{projectId}/contributors/{contributorId}/assign")
    public GitContributorView assign(@PathVariable Long projectId, @PathVariable Long contributorId,
                                     @Valid @RequestBody AssignContributorRequest request) {
        return adminService.assign(projectId, contributorId, request.userId());
    }

    @Operation(summary = "Undo the assignment of an e-mail-only contributor (PM)")
    @DeleteMapping("/projects/{projectId}/contributors/{contributorId}/assign")
    public GitContributorView unassign(@PathVariable Long projectId, @PathVariable Long contributorId) {
        return adminService.unassign(projectId, contributorId);
    }
}
