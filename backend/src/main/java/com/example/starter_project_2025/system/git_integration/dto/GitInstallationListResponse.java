package com.example.starter_project_2025.system.git_integration.dto;

import java.util.List;

/**
 * Installations of the current tenant. {@code status} summarizes them:
 * CONNECTED if any is connected, else ERROR (GI-02) if one is in error,
 * SUSPENDED if one is suspended, NOT_CONNECTED otherwise.
 */
public record GitInstallationListResponse(
        String status,
        boolean canManage,
        List<GitInstallationResponse> installations) {
}
