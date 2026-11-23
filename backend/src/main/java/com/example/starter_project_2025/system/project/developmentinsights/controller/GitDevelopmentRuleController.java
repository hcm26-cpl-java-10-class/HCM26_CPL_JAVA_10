package com.example.starter_project_2025.system.project.developmentinsights.controller;

import com.example.starter_project_2025.system.project.developmentinsights.service.GitDevelopmentRuleService;
import com.example.starter_project_2025.system.project.developmentinsights.service.GitCommitValidationService;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommitValidationStatus;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRuleType;
import com.example.starter_project_2025.system.project.developmentinsights.service.GitComplianceService;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/workspaces/{workspaceId}/git-activity/rules")
@PreAuthorize("hasAnyAuthority('WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
@RequiredArgsConstructor
public class GitDevelopmentRuleController {
    private final GitDevelopmentRuleService service;
    private final GitCommitValidationService validation;
    private final GitComplianceService compliance;

    @GetMapping
    public List<GitDevelopmentRuleService.RuleView> list(@PathVariable Long workspaceId) {
        return service.list(workspaceId);
    }

    @PutMapping
    public GitDevelopmentRuleService.RuleView save(@PathVariable Long workspaceId,
                                                   @RequestBody GitDevelopmentRuleService.RuleInput input) {
        return service.save(workspaceId, input);
    }

    @org.springframework.web.bind.annotation.PostMapping("/validate")
    public List<GitCommitValidationService.ValidationView> validateAvailable(@PathVariable Long workspaceId) {
        return validation.validateLatestWorkspaceCommits(workspaceId);
    }

    @org.springframework.web.bind.annotation.PostMapping("/commits/{commitId}/validate")
    public List<GitCommitValidationService.ValidationView> validateCommit(@PathVariable Long workspaceId,
                                                                           @PathVariable Long commitId) {
        return validation.validateWorkspaceCommit(workspaceId, commitId);
    }

    @GetMapping("/compliance")
    public GitComplianceService.ComplianceReport compliance(
            @PathVariable Long workspaceId,
            @org.springframework.web.bind.annotation.RequestParam(required = false) Long developerId,
            @org.springframework.web.bind.annotation.RequestParam(required = false) GitDevelopmentRuleType ruleType,
            @org.springframework.web.bind.annotation.RequestParam(required = false) GitCommitValidationStatus status,
            @org.springframework.web.bind.annotation.RequestParam(required = false)
            @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate from,
            @org.springframework.web.bind.annotation.RequestParam(required = false)
            @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate to,
            @org.springframework.web.bind.annotation.RequestParam(required = false) String search,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "false") boolean failedOnly,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "0") @jakarta.validation.constraints.Min(0) int page,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "20") @jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(100) int size) {
        return compliance.report(workspaceId, developerId, ruleType, status, from, to, search, failedOnly, page, size);
    }
}
