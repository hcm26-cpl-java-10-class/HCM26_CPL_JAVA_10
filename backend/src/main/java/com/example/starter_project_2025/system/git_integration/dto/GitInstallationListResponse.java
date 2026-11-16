package com.example.starter_project_2025.system.git_integration.dto;

import java.util.List;

/**
 * Installations of the current tenant. {@code status} summarizes them:
 * CONNECTED if any is connected, SUSPENDED if none is but one is suspended,
 * NOT_CONNECTED otherwise.
 */
public record GitInstallationListResponse(
        String status,
        boolean canManage,
        List<GitInstallationResponse> installations) {
}
