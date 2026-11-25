package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;

import java.time.LocalDateTime;
import java.util.List;

/** A page of an installation's repositories after server-side search and filtering. */
public record GitRepositoryPage(
        InstallationSummary installation,
        List<GitRepositoryItem> items,
        int page,
        int size,
        long totalElements,
        int totalPages,
        Counts counts,
        LocalDateTime fetchedAt,
        boolean fromCache,
        boolean truncated) {

    public record InstallationSummary(Long id, String accountLogin, String accountType, GitInstallationStatus status) {
    }

    /** Totals for the current search, per filter tab. */
    public record Counts(long all, long available, long linked) {
    }
}
