package com.example.starter_project_2025.system.git_integration.github;

import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallation;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationRepositoriesPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationToken;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubUser;

import java.util.Optional;

/**
 * Calls to GitHub needed by the connect flow. Kept behind an interface so the
 * connection service can be tested without network access.
 * All methods throw {@link GitHubApiException} on transport or HTTP errors.
 */
public interface GitHubApiClient {

    /** Exchanges the one-time OAuth {@code code} for a user-to-server access token. */
    String exchangeCodeForUserToken(String code);

    GitHubUser getAuthenticatedUser(String userToken);

    /** True when {@code installationId} is visible to the user owning {@code userToken}. */
    boolean userCanAccessInstallation(String userToken, long installationId);

    /** Installation details using the App JWT; empty when it does not belong to this App. */
    Optional<GitHubInstallation> getInstallation(long installationId);

    /**
     * Creates a short-lived installation access token (App JWT), limited to read-only metadata.
     * Throws with {@link GitHubApiException.Kind#GONE} when the app was uninstalled and
     * {@link GitHubApiException.Kind#SUSPENDED} when the installation is suspended.
     */
    GitHubInstallationToken createInstallationToken(long installationId);

    /** One page (max 100) of the repositories the installation can access, public and private. */
    GitHubInstallationRepositoriesPage listInstallationRepositories(String installationToken, int page);
}
