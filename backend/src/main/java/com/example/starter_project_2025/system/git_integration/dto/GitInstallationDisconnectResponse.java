package com.example.starter_project_2025.system.git_integration.dto;

import java.util.List;

/**
 * GI-07: result of a disconnection.
 *
 * @param repositoriesDisconnected repository connections that stopped synchronizing now
 * @param projects                 master projects that read a repository through the installation (now DISCONNECTED)
 * @param alreadyRemovedOnGitHub   the App had already been uninstalled on GitHub (or the installation was disconnected before)
 */
public record GitInstallationDisconnectResponse(
        GitInstallationResponse installation,
        int repositoriesDisconnected,
        List<GitInstallationResponse.LinkedProject> projects,
        boolean alreadyRemovedOnGitHub) {
}
