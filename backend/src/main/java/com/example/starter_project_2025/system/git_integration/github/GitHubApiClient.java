package com.example.starter_project_2025.system.git_integration.github;

import com.example.starter_project_2025.system.git_integration.github.dto.GitHubBranch;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCommit;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubCompareResult;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallation;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationRepositoriesPage;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubInstallationToken;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubUser;

import java.util.List;
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

    /**
     * SY-04: like {@link #createInstallationToken} but also with read-only {@code contents}, needed to
     * read commits. The GitHub App must hold "Contents: Read" (GitHub requires it for push webhooks);
     * otherwise GitHub answers 422 ({@link GitHubApiException.Kind#REJECTED}).
     */
    GitHubInstallationToken createContentsToken(long installationId);

    /** One page (max 100) of the repositories the installation can access, public and private. */
    GitHubInstallationRepositoriesPage listInstallationRepositories(String installationToken, int page);

    /**
     * GI-04: a repository by GitHub's numeric id (stable across renames and transfers), read
     * with an installation token. Empty when the installation cannot access it (GitHub answers
     * 404 both for "not granted" and "deleted"), or when access is refused (403, not a rate limit).
     */
    Optional<GitHubRepository> getRepository(String installationToken, long repositoryId);

    /** GI-04: one page (max 100) of a repository's branches. */
    List<GitHubBranch> listBranches(String installationToken, String owner, String repository, int page);

    /**
     * SY-04: one page (100 commits) of the commits of {@code head} that are not in {@code base},
     * oldest first. Used when a push payload was truncated.
     */
    GitHubCompareResult compareCommits(String installationToken, String owner, String repository,
                                       String base, String head, int page);

    /** SY-04: one page (100 commits) of the history reachable from {@code sha}, newest first. */
    List<GitHubCommit> listCommits(String installationToken, String owner, String repository, String sha, int page);
}
