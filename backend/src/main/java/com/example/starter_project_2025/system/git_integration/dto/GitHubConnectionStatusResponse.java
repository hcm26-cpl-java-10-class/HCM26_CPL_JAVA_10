package com.example.starter_project_2025.system.git_integration.dto;

import java.util.List;

/**
 * Project-level summary: CONNECTED if any installation is connected,
 * SUSPENDED if all are suspended, NOT_CONNECTED otherwise.
 */
public record GitHubConnectionStatusResponse(
        Long projectId,
        String status,
        boolean canManage,
        List<GitHubConnectionResponse> connections) {
}
