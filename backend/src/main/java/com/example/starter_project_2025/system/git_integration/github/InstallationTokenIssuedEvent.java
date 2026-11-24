package com.example.starter_project_2025.system.git_integration.github;

/** GI-02: GitHub issued a new installation token, so the installation works (an ERROR one recovers). */
public record InstallationTokenIssuedEvent(long installationId) {
}
