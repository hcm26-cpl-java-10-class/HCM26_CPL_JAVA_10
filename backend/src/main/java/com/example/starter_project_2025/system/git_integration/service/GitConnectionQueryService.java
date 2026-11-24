package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppCredentials;
import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.dto.GitHubConnectionView;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.rbac.user.User;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * GI-02: the GitHub connection status of a project, i.e. of the installation its master's
 * repository is read through (a module reads its master's). No repository linked: DISCONNECTED
 * with reason NOT_LINKED. Anyone who can open the project sees it; acting on it is for the PM of
 * the master, its mentor or a Git Integration manager ({@link GitRepositoryLinkPolicy#canSync}).
 */
@Service
@RequiredArgsConstructor
public class GitConnectionQueryService {

    private final GitIntegrationAccessService access;
    private final GitProjectResolver projects;
    private final GitRepositoryLinkPolicy policy;
    private final GitRepositoryRepository connections;
    private final GitInstallationRepository installations;
    private final GitHubAppCredentials credentials;
    private final GitHubAppProperties properties;

    /** The project's view and the installation it is about (empty when no repository is linked). */
    public record Resolved(GitHubConnectionView view, Optional<Long> installationRowId, boolean canOperate) {
    }

    @Transactional(readOnly = true)
    public GitHubConnectionView view(Long projectId) {
        return resolve(access.requireUser(), projectId).view();
    }

    @Transactional(readOnly = true)
    public Resolved resolve(User user, Long projectId) {
        Project project = projects.require(user, projectId);
        policy.requireCanView(user, project);
        Project master = projects.masterOf(project);
        boolean inherited = !master.getId().equals(project.getId());
        boolean canOperate = policy.canSync(user, master);
        boolean canConnect = access.canManage(user) && credentials.isEnabled();
        long connected = installations.findByTenant_IdAndProviderAndIsActiveTrueOrderByConnectedAtDesc(
                        user.getTenant().getId(), GitProvider.GITHUB).stream()
                .filter(row -> row.getStatus() == GitInstallationStatus.CONNECTED)
                .count();

        GitRepository repository = connections.findCurrent(master.getId()).orElse(null); // GI-05: ACTIVE, ERROR or DISCONNECTED
        GitInstallation installation = repository == null ? null
                : installations.findById(repository.getInstallationRef()).orElse(null);

        if (installation == null) {
            // AC02: the project reads no repository yet.
            GitHubConnectionView view = new GitHubConnectionView(GitInstallationStatus.DISCONNECTED, GitHubConnectionView.NOT_LINKED,
                    null, null, null, null, null, GitProjectResolver.summary(master), inherited, connected,
                    new GitHubConnectionView.Actions(false, false, canConnect && connected == 0,
                            !inherited && connected > 0 && policy.canLink(user, master) && projects.isLinkable(master)));
            return new Resolved(view, Optional.empty(), canOperate);
        }
        GitInstallationStatus status = installation.getStatus();
        boolean broken = status != GitInstallationStatus.CONNECTED;
        GitHubConnectionView view = new GitHubConnectionView(
                status,
                broken ? installation.getStatusReason() : null,
                installation.getStatusChangedAt(),
                new GitHubConnectionView.Account(installation.getId(), installation.getAccountLogin(), installation.getAccountType(),
                        manageUrl(installation)),
                new GitHubConnectionView.Repository(repository.getFullName(), repository.getStatus()),
                installation.getLastVerifiedAt(),
                installation.getLastCheckedAt(),
                GitProjectResolver.summary(master),
                inherited,
                Math.max(0, connected - (broken ? 0 : 1)),
                // GI-07: the installation was disconnected and another one works: link the repository again (BR7).
                new GitHubConnectionView.Actions(canOperate, canOperate && broken, canConnect,
                        status == GitInstallationStatus.DISCONNECTED && !inherited && connected > 0
                                && policy.canLink(user, master) && projects.isLinkable(master)));
        return new Resolved(view, Optional.of(installation.getId()), canOperate);
    }

    /** GitHub page where the App installation of this account is managed (suspend, uninstall, permissions). */
    private String manageUrl(GitInstallation installation) {
        String web = properties.getWebBaseUrl().endsWith("/")
                ? properties.getWebBaseUrl().substring(0, properties.getWebBaseUrl().length() - 1) : properties.getWebBaseUrl();
        return "Organization".equalsIgnoreCase(installation.getAccountType())
                ? web + "/organizations/" + installation.getAccountLogin() + "/settings/installations/" + installation.getInstallationId()
                : web + "/settings/installations/" + installation.getInstallationId();
    }

    /** "Check again" from a project: only someone who may act on the project's connection. */
    public Long requireRecheckable(Resolved resolved) {
        if (!resolved.canOperate()) {
            throw new org.springframework.security.access.AccessDeniedException("Checking this project's GitHub connection is not allowed");
        }
        return resolved.installationRowId().orElseThrow(GitIntegrationException::repositoryNotLinked);
    }
}
