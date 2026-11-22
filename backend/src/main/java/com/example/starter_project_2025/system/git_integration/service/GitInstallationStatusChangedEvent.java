package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;

/**
 * GI-02: an installation's status really changed (published inside the writing transaction;
 * listen AFTER_COMMIT). {@code reason} is one of {@link GitInstallationReason}.
 */
public record GitInstallationStatusChangedEvent(Long tenantId, Long installationRowId, String accountLogin,
                                                GitInstallationStatus from, GitInstallationStatus to, String reason) {
}
