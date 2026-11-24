package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;

import java.time.LocalDateTime;

/**
 * GI-02: the GitHub connection of a project: the installation its master's repository is read
 * through. Never carries tokens, keys or secrets. {@code reason = NOT_LINKED} (status DISCONNECTED)
 * when the master has no repository linked. {@code actions} say what the viewer may do, computed
 * by the server.
 */
public record GitHubConnectionView(
        GitInstallationStatus status,
        String reason,
        LocalDateTime since,
        Account account,
        Repository repository,
        LocalDateTime lastVerifiedAt,
        LocalDateTime lastCheckedAt,
        GitLinkDetails.ProjectSummary master,
        boolean inherited,
        long otherConnectedAccounts,
        Actions actions) {

    public static final String NOT_LINKED = "NOT_LINKED";

    public record Account(Long installationRowId, String login, String type, String manageUrl) {
    }

    public record Repository(String fullName, GitRepositoryStatus status) {
    }

    /**
     * @param canRecheck        "Check again" (PM of the master, mentor or Git Integration manager)
     * @param canReconnect      the connection is broken and the viewer may act on it
     * @param canConnect        may start Connect GitHub (installs or reconnects the App; Git Integration manager)
     * @param canLinkRepository no repository linked yet and the viewer may link one (Git Integration manager)
     *                          <p>Removing the GitHub App is not offered here: it affects every project of the
     *                          account, so it lives on the Git Integration page (installation card).
     */
    public record Actions(boolean canRecheck, boolean canReconnect, boolean canConnect, boolean canLinkRepository) {
    }

    /** Answer of "Check again": {@code checked = false} when checked less than 30 seconds ago. */
    public record Recheck(GitHubConnectionView connection, boolean checked) {
    }
}
